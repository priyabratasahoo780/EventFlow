const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader) return res.status(401).json({ error: 'Access denied. No token provided.' });

  try {
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_eventflow2026';
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    req.userId = decoded._id || decoded.id;
    next();
  } catch (ex) {
    res.status(400).json({ error: 'Invalid token.' });
  }
};
