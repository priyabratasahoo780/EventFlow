const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/google', authLimiter, authController.googleLogin);
router.post('/sync', authController.syncUser);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.get('/profile', auth, authController.getProfile);

// 2FA Routes
router.post('/2fa/toggle', auth, authController.toggle2FA);
router.post('/2fa/send', authController.send2FA);
router.post('/2fa/verify', authController.verify2FA);

module.exports = router;
