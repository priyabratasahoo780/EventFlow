  // Protected Admin Portal API routes requiring authenticated admin privileges.
 
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');
const adminController = require('../controllers/admin.controller');

router.use(authMiddleware, adminMiddleware);

router.get('/overview', adminController.getOverview);
router.patch('/profile', adminController.updateAdminProfile);
router.post('/change-password', adminController.changeAdminPassword);
router.post('/verify-password', adminController.verifyAdminPassword);
router.get('/reviews/stats', adminController.getReviewStats);
router.get('/reviews', adminController.getAllReviews);
router.delete('/reviews/:id', adminController.deleteReview);
router.get('/users', adminController.getUsers);
router.patch('/users/:id/ban', adminController.toggleBanUser);
router.delete('/users/:id', adminController.deleteUser);
// Strict privacy isolation: Admin cannot view or inspect any user's personal tasks
router.get('/tasks', adminController.getTasks);
router.delete('/tasks/:id', adminController.deleteTask);

// Festival greeting cards
router.get('/festival', adminController.getFestivalBanners);
router.post('/festival', adminController.createFestivalBanner);
router.patch('/festival/:id/toggle', adminController.toggleFestivalBanner);
router.delete('/festival/:id', adminController.deleteFestivalBanner);

// App Monitoring Center (5/10 min synthetic probes, status codes, glitch locator, stats)
router.get('/monitoring', adminController.getMonitoring);
router.post('/monitoring/probe', adminController.runMonitoringProbe);
router.patch('/monitoring/interval', adminController.updateMonitoringInterval);
router.delete('/monitoring/glitches', adminController.clearMonitoringGlitches);

module.exports = router;
