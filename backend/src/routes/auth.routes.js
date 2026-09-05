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

module.exports = router;
