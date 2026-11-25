/**
 * task.routes.js
 * Express routing definitions for task management endpoints.
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userOnly = require('../middleware/userOnly.middleware');
const taskController = require('../controllers/task.controller');

router.use(authMiddleware, userOnly);

router.get('/', taskController.getTasks);
router.get('/recommendation', taskController.getRecommendation);
router.post('/', taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.patch('/:id/status', taskController.updateStatus);
router.delete('/:id', taskController.deleteTask);

// Geofence Buddy Alert: friend's phone calls this when they enter the task's geofence
router.post('/:id/buddy-near', taskController.buddyNearLocation);

module.exports = router;
