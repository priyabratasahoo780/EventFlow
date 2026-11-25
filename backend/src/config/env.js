/**
 * src/config/env.js
 * Validates all required environment variables at startup.
 * Throws immediately if any are missing — fail fast, fail loud.
 */

'use strict';

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

  return {
    PORT: parseInt(process.env.PORT || '5000', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || '',
  };
}

module.exports = { validateEnv };
