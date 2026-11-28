  // Global Express error handler that sanitizes internal details in production.
 
'use strict';

const logger = require('../utils/logger');

module.exports = (err, req, res, _next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Handle Multer upload errors gracefully with 400 status
  if (err && (err.name === 'MulterError' || err.code === 'INVALID_FILE_TYPE')) {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      error: err.message || 'Invalid file upload.',
      message: err.message || 'Invalid file upload.',
    });
  }

  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    logger.error(`[Error] ${req.method} ${req.originalUrl}`, err);
  }

  const safeMessage =
    statusCode >= 500 && isProd
      ? 'Internal Server Error'
      : (err.message || 'Internal Server Error');

  res.locals.errorMessage = safeMessage;

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    error: safeMessage,
    message: safeMessage,
  });
};
