'use strict';

const logger = require('../utils/logger');

const REQUIRED_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required environment variables:\n  ${missing.join('\n  ')}\n` +
      'Please set them in your .env file before starting the server.'
    );
  }

  if (process.env.JWT_SECRET.length < 32) {
    logger.warn('[ENV] JWT_SECRET is shorter than 32 characters. Use a 64+ char random secret in production.');
  }

  return {
    PORT: parseInt(process.env.PORT || '5000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || '',
    EMAIL_USER: process.env.EMAIL_USER || '',
    EMAIL_PASS: process.env.EMAIL_PASS || '',
    EMAIL_FROM: process.env.EMAIL_FROM || '',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  };
}

module.exports = { validateEnv };
