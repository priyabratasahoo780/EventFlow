const logger = require('../utils/logger');

/**
 * Mock Email Service
 * In a real application, this would use nodemailer or a transactional email service 
 * (like SendGrid, AWS SES) to send emails.
 */

exports.send2FAEmail = async (toEmail, otp) => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  logger.info(`====================================================`);
  logger.info(`📧 MOCK EMAIL SENT`);
  logger.info(`To: ${toEmail}`);
  logger.info(`Subject: Your 2-Factor Authentication Code`);
  logger.info(`Code: ${otp}`);
  logger.info(`====================================================`);
  
  return true;
};
