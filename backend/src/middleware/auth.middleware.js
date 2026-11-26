  // Verifies Bearer JWT access tokens, rejects temporary 2FA tokens, and blocks banned users.
 
'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({ error: 'Server authentication configuration error.' });
  }

  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Empty token.' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded || decoded.isTemp) {
      return res.status(401).json({ error: 'Complete two-factor verification before accessing resources.' });
    }

    const userId = decoded._id || decoded.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid authentication token payload.' });
    }

    const dbUser = await User.findById(userId).select('role isBanned').lean();
    if (!dbUser) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }
    if (dbUser.isBanned) {
      return res.status(403).json({ error: 'Your account has been suspended by an administrator.' });
    }

    req.user = { ...decoded, role: dbUser.role || 'user' };
    req.userId = userId;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
};
