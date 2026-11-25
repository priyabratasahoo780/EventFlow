/**
 * auth.middleware.js
 * Verifies Bearer JWT access tokens and rejects temporary 2FA session tokens.
 */
'use strict';

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
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

    req.user = decoded;
    req.userId = userId;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Session expired or invalid token. Please log in again.' });
  }
};
