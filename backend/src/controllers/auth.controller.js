const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../services/email.service');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_eventflow2026';

// Generate rich unique ID of EXACTLY 8 characters (Capitals, Smalls, Numbers & Symbols, e.g. K#7a$9mP)
const generateUniqueId = async () => {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*_-';

  const getRandom = (set) => set[Math.floor(Math.random() * set.length)];

  let isUnique = false;
  let uniqueId = '';

  while (!isUnique) {
    // 2 Capitals + 2 Smalls + 2 Numbers + 2 Symbols = 8 characters exactly
    const chars = [
      getRandom(uppers),
      getRandom(lowers),
      getRandom(numbers),
      getRandom(symbols),
      getRandom(uppers),
      getRandom(lowers),
      getRandom(numbers),
      getRandom(symbols)
    ];

    // Shuffle characters
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    uniqueId = chars.join(''); // Total 8 characters strictly
    const exists = await User.findOne({ uniqueId });
    if (!exists) {
      isUnique = true;
    }
  }

  return uniqueId;
};

const validateStrongPassword = (pwd) => {
  if (!pwd || pwd.length < 8) {
    return 'Password must be at least 8 characters long.';
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

exports.register = async (req, res) => {
  try {
    const { name, username, email, password, city, profilePhoto } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const pwdError = validateStrongPassword(password);
    if (pwdError) {
      return res.status(400).json({ error: pwdError });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || email.split('@')[0]).trim().toLowerCase();

    // Check if username or email exists
    const existingUser = await User.findOne({ 
      $or: [{ email: cleanEmail }, { username: cleanUsername }] 
    });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email already registered' });
    }

    const uniqueId = await generateUniqueId();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      uniqueId,
      name,
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      city: city || '',
      profilePhoto: profilePhoto || ''
    });

    await user.save();

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        _id: user._id,
        uniqueId: user.uniqueId,
        name: user.name,
        username: user.username,
        email: user.email,
        city: user.city,
        profilePhoto: user.profilePhoto
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ 
      $or: [{ email: cleanEmail }, { username: cleanEmail }] 
    });
    
    if (!user) {
      return res.status(404).json({ 
        error: 'Account does not exist. Please create an account first.', 
        accountNotFound: true 
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Incorrect password. Please check and try again.' });
    }

    if (user.twoFactorEnabled) {
      // Create a temporary token valid for 10 minutes
      const tempToken = jwt.sign({ _id: user._id, isTemp: true }, JWT_SECRET, { expiresIn: '10m' });
      
      return res.json({
        requires2FA: true,
        email: user.email,
        tempToken
      });
    }

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        _id: user._id,
        uniqueId: user.uniqueId,
        name: user.name,
        username: user.username,
        email: user.email,
        city: user.city,
        profilePhoto: user.profilePhoto,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Login failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
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
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { email, name, profilePhoto } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Google email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: cleanEmail });

    if (!user) {
      const uniqueId = await generateUniqueId();
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
      const cleanUsername = (cleanEmail.split('@')[0] || 'focususer').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

      user = new User({
        uniqueId,
        name: name || cleanUsername,
        username: cleanUsername,
        email: cleanEmail,
        password: randomPassword,
        profilePhoto: profilePhoto || '',
        city: ''
      });

      await user.save();
    }

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        _id: user._id,
        uniqueId: user.uniqueId,
        name: user.name,
        username: user.username,
        email: user.email,
        city: user.city,
        profilePhoto: user.profilePhoto
      }
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ error: 'Google authentication failed' });
  }
};

exports.syncUser = async (req, res) => {
  try {
    const { uniqueId, name, username, email, profilePhoto } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || email.split('@')[0]).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

    let user = await User.findOne({
      $or: [
        { email: cleanEmail },
        ...(uniqueId ? [{ uniqueId: { $regex: new RegExp(`^${uniqueId.trim()}$`, 'i') } }] : []),
        { username: cleanUsername }
      ]
    });

    if (!user) {
      const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);
      const isOldFormat = !uniqueId || uniqueId.startsWith('FOCUS') || uniqueId.startsWith('EVENT');
      const finalUniqueId = isOldFormat ? await generateUniqueId() : uniqueId;

      user = new User({
        uniqueId: finalUniqueId,
        name: name || cleanUsername,
        username: cleanUsername,
        email: cleanEmail,
        password: randomPassword,
        profilePhoto: profilePhoto || '',
        city: ''
      });
      await user.save();
    } else {
      if (name) user.name = name;
      // Auto-migrate old FOCUS/EVENT format IDs to new rich FF# format
      if (!user.uniqueId || user.uniqueId.startsWith('FOCUS') || user.uniqueId.startsWith('EVENT')) {
        user.uniqueId = await generateUniqueId();
      } else if (uniqueId && !uniqueId.startsWith('FOCUS') && !uniqueId.startsWith('EVENT')) {
        user.uniqueId = uniqueId;
      }
      if (profilePhoto) user.profilePhoto = profilePhoto;
      await user.save();
    }

    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        _id: user._id,
        uniqueId: user.uniqueId,
        name: user.name,
        username: user.username,
        email: user.email,
        city: user.city,
        profilePhoto: user.profilePhoto
      }
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

// ── Two-Factor Authentication Methods ──────────────────────────────────────

exports.toggle2FA = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Invalid enabled status.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { twoFactorEnabled: enabled },
      { new: true }
    ).select('-password');

    res.json({ message: `2FA has been ${enabled ? 'enabled' : 'disabled'}.`, user: updatedUser });
  } catch (err) {
    console.error('toggle2FA error:', err);
    res.status(500).json({ error: 'Failed to toggle 2FA status.' });
  }
};

exports.send2FA = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    user.twoFactorOtp = hashedOtp;
    user.twoFactorOtpExpiry = new Date(Date.now() + 10 * 60000); // 10 minutes
    await user.save();

    await emailService.send2FAEmail(user.email, otp);

    res.json({ message: '2FA code sent successfully.' });
  } catch (err) {
    console.error('send2FA error:', err);
    res.status(500).json({ error: 'Failed to send 2FA code.' });
  }
};

exports.verify2FA = async (req, res) => {
  try {
    const { email, otp, tempToken } = req.body;
    
    if (!email || !otp || !tempToken) {
      return res.status(400).json({ error: 'Email, OTP, and tempToken are required.' });
    }

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
      if (!decoded.isTemp) {
        throw new Error('Invalid token type');
      }
    } catch (tokenErr) {
      return res.status(401).json({ error: 'Temporary token expired or invalid. Please login again.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail, _id: decoded._id });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!user.twoFactorOtp || !user.twoFactorOtpExpiry) {
      return res.status(400).json({ error: 'No 2FA code generated. Please request a new code.' });
    }

    if (new Date() > user.twoFactorOtpExpiry) {
      return res.status(400).json({ error: '2FA code expired. Please request a new code.' });
    }

    const validOtp = await bcrypt.compare(otp, user.twoFactorOtp);
    if (!validOtp) {
      return res.status(400).json({ error: 'Invalid 2FA code.' });
    }

    // Clear OTP fields
    user.twoFactorOtp = null;
    user.twoFactorOtpExpiry = null;
    await user.save();

    // Issue real token
    const token = jwt.sign({ _id: user._id, uniqueId: user.uniqueId }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        _id: user._id,
        uniqueId: user.uniqueId,
        name: user.name,
        username: user.username,
        email: user.email,
        city: user.city,
        profilePhoto: user.profilePhoto,
        twoFactorEnabled: user.twoFactorEnabled
      }
    });
  } catch (err) {
    console.error('verify2FA error:', err);
    res.status(500).json({ error: 'Failed to verify 2FA code.' });
  }
};


