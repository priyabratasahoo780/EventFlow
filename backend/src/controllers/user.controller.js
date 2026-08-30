const User = require('../models/User');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.userId, req.body, { returnDocument: 'after' }).select('-password');
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    // req.user._id is the standard for the authMiddleware
    // wait, getProfile uses req.userId. Let me check authMiddleware to be sure.
    // I will use req.userId or req.user._id based on what authMiddleware sets.
    // getProfile uses req.userId.
    await User.findByIdAndUpdate(req.userId || req.user._id, { expoPushToken: token });
    res.json({ message: 'Token updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
