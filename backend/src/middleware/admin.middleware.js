  // Ensures authenticated user holds active admin privileges.
 
'use strict';

const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const adminUser = await User.findById(req.userId).select('role isBanned email name').lean();
    if (!adminUser || adminUser.isBanned || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin portal access required.' });
    }

    req.adminUser = adminUser;
    next();
  } catch (_err) {
    res.status(500).json({ error: 'Failed to verify administrator permissions.' });
  }
};
