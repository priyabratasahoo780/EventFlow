  // Express routing definitions for user authentication endpoints.
 
'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.googleLogin);
router.post('/sync', auth, authController.syncUser);
router.post('/forgot-password/send-otp', otpLimiter, authController.sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', otpLimiter, authController.verifyForgotPasswordOtp);
router.post('/forgot-password', otpLimiter, authController.forgotPassword);
router.post('/change-password/send-otp', auth, otpLimiter, authController.sendChangePasswordOtp);
router.post('/change-password/verify-otp', auth, otpLimiter, authController.verifyChangePasswordOtp);
router.post('/change-password', auth, otpLimiter, authController.changePassword);
router.get('/profile', auth, authController.getProfile);

// 2FA Routes
router.post('/2fa/toggle', auth, authLimiter, authController.toggle2FA);
router.post('/2fa/send', otpLimiter, authController.send2FA);
router.post('/2fa/verify', otpLimiter, authController.verify2FA);

module.exports = router;
