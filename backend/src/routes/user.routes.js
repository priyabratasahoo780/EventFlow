/**
 * user.routes.js
 * User profile endpoints and account deletion route.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userOnly = require('../middleware/userOnly.middleware');
const userController = require('../controllers/user.controller');

router.use(authMiddleware);

router.get('/profile', userController.getProfile);
router.put('/profile', userOnly, userController.updateProfile);
router.post('/push-token', userOnly, userController.updatePushToken);
router.delete('/account', userOnly, userController.deleteAccount);

module.exports = router;
