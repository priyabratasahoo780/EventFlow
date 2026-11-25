/**
 * admin.routes.js
 * Protected Admin Portal API routes requiring authenticated admin privileges.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const adminController = require('../controllers/admin.controller');

router.use(authMiddleware, adminMiddleware);

router.get('/overview', adminController.getOverview);
router.get('/reviews', adminController.getAllReviews);
router.delete('/reviews/:id', adminController.deleteReview);
router.get('/users', adminController.getUsers);
router.patch('/users/:id/ban', adminController.toggleBanUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/tasks', adminController.getTasks);
router.delete('/tasks/:id', adminController.deleteTask);

module.exports = router;
