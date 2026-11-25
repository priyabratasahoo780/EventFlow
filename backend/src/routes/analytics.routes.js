const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userOnly = require('../middleware/userOnly.middleware');
const analyticsController = require('../controllers/analytics.controller');

router.use(authMiddleware, userOnly);

router.get('/dashboard', analyticsController.getDashboardAnalytics);
router.get('/weekly', analyticsController.getWeeklyAnalytics);
router.get('/categories', analyticsController.getCategoriesAnalytics);

module.exports = router;
