/**
 * user.routes.js
 * User profile endpoints and account deletion route.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.post('/push-token', userController.updatePushToken);
router.delete('/account', userController.deleteAccount);

module.exports = router;
