/**
 * festival.routes.js
 * Authenticated endpoint for fetching the active festival greeting card.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminController = require('../controllers/admin.controller');

router.get('/active', authMiddleware, adminController.getActiveFestivalBanner);

module.exports = router;
