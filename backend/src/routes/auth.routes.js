/**
 * auth.routes.js
 * Express routing definitions for user authentication endpoints.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.googleLogin);
router.post('/sync', auth, authLimiter, authController.syncUser);
router.post('/forgot-password/send-otp', otpLimiter, authController.sendForgotPasswordOtp);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.get('/profile', auth, authController.getProfile);

// 2FA Routes
router.post('/2fa/toggle', auth, authLimiter, authController.toggle2FA);
router.post('/2fa/send', otpLimiter, authController.send2FA);
router.post('/2fa/verify', otpLimiter, authController.verify2FA);

module.exports = router;
