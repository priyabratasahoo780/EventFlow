
  // Authentication controller handling login, register, 2FA, OTP password reset, and Clerk-verified Google OAuth.
 
'use strict';

const crypto = require('crypto');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../services/email.service');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }
  return process.env.JWT_SECRET;
};

const OTP_EXPIRY_MS = 10 * 60 * 1000;     // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 25 * 1000; // 25 seconds server-side cooldown
const MAX_OTP_ATTEMPTS = 5;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000; // 24 hours rolling day
const MAX_DAILY_PASSWORD_CHANGES = 2; // Strict limit: max 2 changes per 24 hours

const checkPasswordChangeLimit = (user) => {
  const now = Date.now();
  const recentChanges = (user.passwordChangeHistory || []).filter(
    (timestamp) => now - new Date(timestamp).getTime() < TWENTY_FOUR_HOURS_MS
  );

  if (recentChanges.length >= MAX_DAILY_PASSWORD_CHANGES) {
    const oldest = recentChanges
      .slice()
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    const waitMs = TWENTY_FOUR_HOURS_MS - (now - new Date(oldest).getTime());
    const waitHours = Math.max(1, Math.ceil(waitMs / (60 * 60 * 1000)));

    return {
      exceeded: true,
      error: `Daily limit reached! You can only change your password ${MAX_DAILY_PASSWORD_CHANGES} times per day. Please try again after ${waitHours} hour${waitHours > 1 ? 's' : ''} (tomorrow).`,
    };
  }

  return { exceeded: false, recentChanges };
};

const generateUniqueId = async () => {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*_-';

  const getRandom = (set) => set[crypto.randomInt(0, set.length)];

  let isUnique = false;
  let uniqueId = '';

  while (!isUnique) {
    const chars = [
      getRandom(uppers),
      getRandom(lowers),
      getRandom(numbers),
      getRandom(symbols),
      getRandom(uppers),
      getRandom(lowers),
      getRandom(numbers),
      getRandom(symbols),
    ];

    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    uniqueId = chars.join('');
    const exists = await User.findOne({ uniqueId });
    if (!exists) {
      isUnique = true;
    }
  }

  return uniqueId;
};

const validateStrongPassword = (pwd) => {
  if (!pwd || typeof pwd !== 'string' || pwd.length < 8 || pwd.length > 128) {
    return 'Password must be between 8 and 128 characters long.';
  }
  if (!/[A-Z]/.test(pwd)) {
    return 'Password must contain at least one uppercase letter (A-Z).';
  }
  if (!/[a-z]/.test(pwd)) {
    return 'Password must contain at least one lowercase letter (a-z).';
  }
  if (!/[0-9]/.test(pwd)) {
    return 'Password must contain at least one number (0-9).';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
    return 'Password must contain at least one special character (e.g. @, #, $, %, !, &, *).';
  }
  return null;
};

const serializeUser = (user) => ({
  _id: user._id,
  uniqueId: user.uniqueId,
  name: user.name,
  username: user.username,
  email: user.email,
  city: user.city,
  profilePhoto: user.profilePhoto,
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
  role: user.role || 'user',
});

const verifyTempToken = (tempToken) => {
  const decoded = jwt.verify(tempToken, getJwtSecret());
  if (!decoded || !decoded.isTemp || !decoded._id) {
    throw new Error('Invalid token type');
  }
  return decoded;
};

const verifyClerkGoogleSession = async (sessionId) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CLERK_NOT_CONFIGURED');
  }

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };

  const sessionRes = await fetch(
    `https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}`,
    { headers, signal: AbortSignal.timeout(8000) }
  );

  if (!sessionRes.ok) {
    throw new Error('Invalid or expired Google OAuth session.');
  }

  const sessionData = await sessionRes.json();
  if (!sessionData || sessionData.status !== 'active' || !sessionData.user_id) {
    throw new Error('Google OAuth session is no longer active.');
  }

  const userRes = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(sessionData.user_id)}`,
    { headers, signal: AbortSignal.timeout(8000) }
  );

  if (!userRes.ok) {
    throw new Error('Could not retrieve verified Google profile.');
  }

  const clerkUser = await userRes.json();
  const emails = Array.isArray(clerkUser.email_addresses) ? clerkUser.email_addresses : [];
  const primaryObj =
    emails.find((e) => e.id === clerkUser.primary_email_address_id) || emails[0];
  const verifiedEmail = primaryObj?.email_address;

  if (!verifiedEmail) {
    throw new Error('No verified email address attached to this Google account.');
  }

  const fullName = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ').trim();
  return {
    email: verifiedEmail.trim().toLowerCase(),
    name: fullName,
    profilePhoto: clerkUser.image_url || '',
  };
};

exports.register = async (req, res) => {
  try {
    const { name, username, email, password, city, profilePhoto } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const cleanName = String(name).trim().slice(0, 80);
    const cleanEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const pwdError = validateStrongPassword(password);
    if (pwdError) {
      return res.status(400).json({ error: pwdError });
    }

    const rawUsername = String(username || cleanEmail.split('@')[0])
      .replace(/[^a-zA-Z0-9_.-]/g, '')
      .trim()
      .toLowerCase()
      .slice(0, 40);

    if (rawUsername.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters.' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: rawUsername }],
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already registered' });
    }

    const uniqueId = await generateUniqueId();
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const safePhoto =
      typeof profilePhoto === 'string' && !profilePhoto.trim().toLowerCase().startsWith('javascript:')
        ? profilePhoto.trim().slice(0, 500)
        : '';

    const user = new User({
      uniqueId,
      name: cleanName,
      username: rawUsername,
      email: cleanEmail,
      password: hashedPassword,
      city: typeof city === 'string' ? city.trim().slice(0, 80) : '',
      profilePhoto: safePhoto,
    });

    await user.save();

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, getJwtSecret(), { expiresIn: '30d' });
    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanEmail }],
    });

    if (!user) {
      return res.status(404).json({
        error: 'Account does not exist. Please create an account first.',
        accountNotFound: true,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Incorrect password. Please check and try again.' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }

    if (user.twoFactorEnabled) {
      const tempToken = jwt.sign({ _id: user._id, isTemp: true }, getJwtSecret(), { expiresIn: '10m' });
      return res.json({
        requires2FA: true,
        email: user.email,
        tempToken,
      });
    }

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, getJwtSecret(), { expiresIn: '30d' });
    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Registered email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    // Check 2-times-per-day password change limit upfront
    const limitCheck = checkPasswordChangeLimit(user);
    if (limitCheck.exceeded) {
      return res.status(429).json({ error: limitCheck.error });
    }

    if (user.resetPasswordLastSentAt) {
      const elapsedMs = Date.now() - new Date(user.resetPasswordLastSentAt).getTime();
      if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        return res.status(429).json({
          error: `Please wait ${waitSec}s before requesting another reset code.`,
        });
      }
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    await emailService.sendOTPEmail(user.email, otp, {
      purpose: 'Password Reset Verification',
      expiryMinutes: 10,
    });

    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordOtpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordLastSentAt = new Date();
    await user.save();

    res.json({ message: 'Password reset verification code sent to your email.' });
  } catch (err) {
    console.error('sendForgotPasswordOtp error:', err);
    if (err && err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Email delivery is not configured on the server. Set EMAIL_USER and EMAIL_PASS in .env.',
      });
    }
    res.status(500).json({ error: 'Failed to send password reset code.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, 6-digit OTP code, and new password are required.' });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit OTP code.' });
    }

    const pwdError = validateStrongPassword(newPassword);
    if (pwdError) {
      return res.status(400).json({ error: pwdError });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    // Enforce 2-times-per-day password change limit
    const limitCheck = checkPasswordChangeLimit(user);
    if (limitCheck.exceeded) {
      return res.status(429).json({ error: limitCheck.error });
    }

    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpiry) {
      return res.status(400).json({ error: 'No reset code requested. Please request a verification code first.' });
    }

    if (new Date() > user.resetPasswordOtpExpiry) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpiry = null;
      user.resetPasswordOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ error: 'Reset code expired. Please request a new code.' });
    }

    if ((user.resetPasswordOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      user.resetPasswordOtp = null;
      user.resetPasswordOtpExpiry = null;
      user.resetPasswordOtpAttempts = 0;
      await user.save();
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new reset code.' });
    }

    const validOtp = await bcrypt.compare(cleanOtp, user.resetPasswordOtp);
    if (!validOtp) {
      const nextAttempts = (user.resetPasswordOtpAttempts || 0) + 1;
      user.resetPasswordOtpAttempts = nextAttempts;

      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        user.resetPasswordOtp = null;
        user.resetPasswordOtpExpiry = null;
        user.resetPasswordOtpAttempts = 0;
        await user.save();
        return res.status(429).json({
          error: 'Too many incorrect attempts. Please request a new reset code.',
        });
      }

      await user.save();
      const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
      return res.status(400).json({
        error: `Invalid OTP code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiry = null;
    user.resetPasswordOtpAttempts = 0;
    user.resetPasswordLastSentAt = null;

    // Record password change timestamp and prune entries older than 24 hours
    const updatedHistory = (limitCheck.recentChanges || []).map((t) => new Date(t));
    updatedHistory.push(new Date());
    user.passwordChangeHistory = updatedHistory;

    await user.save();

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User profile not found' });
    res.json(user);
  } catch (_err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { sessionId, name, profilePhoto } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(401).json({ error: 'Verified Google OAuth session is required.' });
    }

    let verifiedProfile;
    try {
      verifiedProfile = await verifyClerkGoogleSession(sessionId);
    } catch (verifyErr) {
      const status = verifyErr.message === 'CLERK_NOT_CONFIGURED' ? 503 : 401;
      return res.status(status).json({
        error:
          verifyErr.message === 'CLERK_NOT_CONFIGURED'
            ? 'Google authentication service is not configured on the server.'
            : verifyErr.message,
      });
    }

    const cleanEmail = verifiedProfile.email;
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      const uniqueId = await generateUniqueId();
      const randomSecret = crypto.randomBytes(24).toString('hex');
      const randomPassword = await bcrypt.hash(randomSecret, 12);
      let cleanUsername = (cleanEmail.split('@')[0] || 'user')
        .replace(/[^a-zA-Z0-9_]/g, '')
        .toLowerCase()
        .slice(0, 32) || 'user';

      const existingUsername = await User.findOne({ username: cleanUsername });
      if (existingUsername) {
        cleanUsername = `${cleanUsername}${crypto.randomInt(100, 9999)}`;
      }

      user = new User({
        uniqueId,
        name: verifiedProfile.name || (typeof name === 'string' && name.trim()) || cleanUsername,
        username: cleanUsername,
        email: cleanEmail,
        password: randomPassword,
        profilePhoto: verifiedProfile.profilePhoto || (typeof profilePhoto === 'string' ? profilePhoto : ''),
        city: '',
      });

      await user.save();
    } else if (user.isBanned) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId, role: user.role || 'user' }, getJwtSecret(), { expiresIn: '30d' });
    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
};

exports.syncUser = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Authenticated user account not found.' });
    }

    const { uniqueId, name, profilePhoto } = req.body;

    if (typeof name === 'string' && name.trim()) {
      user.name = name.trim().slice(0, 80);
    }

    // Auto-migrate old FOCUS/EVENT format IDs or apply user-regenerated 8-char unique ID safely
    if (!user.uniqueId || user.uniqueId.startsWith('FOCUS') || user.uniqueId.startsWith('EVENT')) {
      user.uniqueId = await generateUniqueId();
    } else if (
      typeof uniqueId === 'string' &&
      uniqueId.trim().length === 8 &&
      uniqueId.trim() !== user.uniqueId &&
      !uniqueId.startsWith('FOCUS') &&
      !uniqueId.startsWith('EVENT')
    ) {
      const collision = await User.findOne({ uniqueId: uniqueId.trim(), _id: { $ne: user._id } });
      if (!collision) {
        user.uniqueId = uniqueId.trim();
      }
    }

    if (
      typeof profilePhoto === 'string' &&
      !profilePhoto.trim().toLowerCase().startsWith('javascript:')
    ) {
      user.profilePhoto = profilePhoto.trim().slice(0, 500);
    }

    await user.save();

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, getJwtSecret(), { expiresIn: '30d' });
    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error('syncUser error:', err);
    res.status(500).json({ error: 'Failed to sync user' });
  }
};

exports.refreshUniqueId = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    const newUniqueId = await generateUniqueId();
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { uniqueId: newUniqueId },
      { returnDocument: 'after' }
    ).select('-password');

    res.json({ uniqueId: newUniqueId, user: updatedUser });
  } catch (err) {
    console.error('refreshUniqueId error:', err);
    res.status(500).json({ error: 'Failed to generate new unique ID' });
  }
};

// Two-Factor Authentication Methods

exports.toggle2FA = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid enabled status.' });
    }

    if (enabled && !emailService.isConfigured()) {
      return res.status(503).json({
        error: 'Two-factor email delivery is not configured on the server yet. Set EMAIL_USER and EMAIL_PASS in backend .env.',
      });
    }

    const updateFields = enabled
      ? { twoFactorEnabled: true }
      : {
          twoFactorEnabled: false,
          twoFactorOtp: null,
          twoFactorOtpExpiry: null,
          twoFactorOtpAttempts: 0,
          twoFactorLastSentAt: null,
        };

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { returnDocument: 'after' }
    ).select('-password');

    res.json({ message: `2FA has been ${enabled ? 'enabled' : 'disabled'}.`, user: updatedUser });
  } catch (err) {
    console.error('toggle2FA error:', err);
    res.status(500).json({ error: 'Failed to toggle 2FA status.' });
  }
};

exports.send2FA = async (req, res) => {
  try {
    const { email, tempToken } = req.body;
    if (!email || !tempToken) {
      return res.status(400).json({ error: 'Email and verification session token are required.' });
    }

    let decoded;
    try {
      decoded = verifyTempToken(tempToken);
    } catch (_tokenErr) {
      return res.status(401).json({ error: 'Login session expired. Please sign in again.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail, _id: decoded._id });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled for this account.' });
    }

    if (user.twoFactorLastSentAt) {
      const elapsedMs = Date.now() - new Date(user.twoFactorLastSentAt).getTime();
      if (elapsedMs < OTP_RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsedMs) / 1000);
        return res.status(429).json({
          error: `Please wait ${waitSec}s before requesting another verification code.`,
        });
      }
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    await emailService.send2FAEmail(user.email, otp);

    user.twoFactorOtp = hashedOtp;
    user.twoFactorOtpExpiry = new Date(Date.now() + OTP_EXPIRY_MS);
    user.twoFactorOtpAttempts = 0;
    user.twoFactorLastSentAt = new Date();
    await user.save();

    res.json({ message: '2FA code sent successfully.' });
  } catch (err) {
    console.error('send2FA error:', err);
    if (err && err.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(503).json({
        error: 'Email delivery is not configured on the server. Please set EMAIL_USER and EMAIL_PASS in .env.',
      });
    }
    res.status(500).json({ error: 'Failed to send 2FA verification email. Please try again.' });
  }
};

exports.verify2FA = async (req, res) => {
  try {
    const { email, otp, tempToken } = req.body;

    if (!email || !otp || !tempToken) {
      return res.status(400).json({ error: 'Email, OTP, and verification session token are required.' });
    }

    const cleanOtp = String(otp).trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit verification code.' });
    }

    let decoded;
    try {
      decoded = verifyTempToken(tempToken);
    } catch (_tokenErr) {
      return res.status(401).json({ error: 'Temporary token expired or invalid. Please login again.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail, _id: decoded._id });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.twoFactorOtp || !user.twoFactorOtpExpiry) {
      return res.status(400).json({ error: 'No 2FA code generated. Please request a new code.' });
    }

    if (new Date() > user.twoFactorOtpExpiry) {
      user.twoFactorOtp = null;
      user.twoFactorOtpExpiry = null;
      user.twoFactorOtpAttempts = 0;
      await user.save();
      return res.status(400).json({ error: '2FA code expired. Please request a new code.' });
    }

    if ((user.twoFactorOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      user.twoFactorOtp = null;
      user.twoFactorOtpExpiry = null;
      user.twoFactorOtpAttempts = 0;
      await user.save();
      return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new verification code.' });
    }

    const validOtp = await bcrypt.compare(cleanOtp, user.twoFactorOtp);
    if (!validOtp) {
      const nextAttempts = (user.twoFactorOtpAttempts || 0) + 1;
      user.twoFactorOtpAttempts = nextAttempts;

      if (nextAttempts >= MAX_OTP_ATTEMPTS) {
        user.twoFactorOtp = null;
        user.twoFactorOtpExpiry = null;
        user.twoFactorOtpAttempts = 0;
        await user.save();
        return res.status(429).json({
          error: 'Too many incorrect attempts. Please tap Resend Code to get a new code.',
        });
      }

      await user.save();
      const remaining = MAX_OTP_ATTEMPTS - nextAttempts;
      return res.status(400).json({
        error: `Invalid 2FA code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      });
    }

    user.twoFactorOtp = null;
    user.twoFactorOtpExpiry = null;
    user.twoFactorOtpAttempts = 0;
    user.twoFactorLastSentAt = null;
    await user.save();

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, getJwtSecret(), { expiresIn: '30d' });
    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error('verify2FA error:', err);
    res.status(500).json({ error: 'Failed to verify 2FA code.' });
  }
};
