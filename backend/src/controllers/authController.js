const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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

exports.register = async (req, res) => {
  try {
    const { name, username, email, password, city, profilePhoto } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
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


