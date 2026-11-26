  // Strictly isolates portals by preventing administrator accounts from accessing user-portal routes.
 
'use strict';

module.exports = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return res.status(403).json({
      error: 'Portal isolation: Administrators cannot access user portal features.',
    });
  }
  next();
};
