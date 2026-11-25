const rateLimit = require('express-rate-limit');

// 1. General Global API Rate Limiter (Protection against DDoS & high traffic spam)
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 400, // Max 400 requests per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// 2. Strict Auth Rate Limiter (Brute-force & credential stuffing protection)
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // Max 40 auth attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login or registration attempts. Please wait a few minutes before trying again.'
  }
});

// 3. Strict 2FA OTP Rate Limiter (Prevents OTP spam & brute-force guessing)
exports.otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Max 15 OTP send/verify requests per 15 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many verification attempts. Please wait a few minutes before trying again.'
  }
});

// 4. Search & Sync Rate Limiter
exports.searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 queries per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Search rate limit exceeded. Please slow down.'
  }
});
