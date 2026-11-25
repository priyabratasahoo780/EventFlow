/**
 * Structured logger utility.
 * Standardizes log formatting with ISO timestamps and levels.
 */

'use strict';

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';

function formatMessage(level, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

const logger = {
  /**
   * General info logging.
   * @param {string} message
   * @param {object} [meta]
   */
  info(message, meta = {}) {
    console.log(formatMessage('info', message, meta));
  },

  /**
   * Debug logging — suppressed in production.
   * @param {string} message
   * @param {object} [meta]
   */
  debug(message, meta = {}) {
    if (!IS_PROD) {
      console.debug(formatMessage('debug', message, meta));
    }
  },

  /**
   * Warning logging.
   * @param {string} message
   * @param {object} [meta]
   */
  warn(message, meta = {}) {
    console.warn(formatMessage('warn', message, meta));
  },

  /**
   * Error logging. Accepts Error objects or strings.
   * @param {string} message
   * @param {Error | object} [err]
   */
  error(message, err = {}) {
    const meta = err instanceof Error
      ? { message: err.message, stack: IS_PROD ? undefined : err.stack }
      : err;
    console.error(formatMessage('error', message, meta));
  },
};

module.exports = logger;
