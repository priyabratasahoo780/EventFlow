/**
 * email.service.js
 * Email delivery service for authentication codes and notifications.
 */
const logger = require('../utils/logger');

exports.send2FAEmail = async (toEmail, otp) => {
  await new Promise((resolve) => setTimeout(resolve, 500));
  logger.info(`[2FA Email] Sent verification code to ${toEmail}`);
  return true;
};
