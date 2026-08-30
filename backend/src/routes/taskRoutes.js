const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const taskController = require('../controllers/task.controller');

router.use(authMiddleware);

router.get('/', taskController.getTasks);
router.get('/recommendation', taskController.getRecommendation);
router.post('/', taskController.createTask);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.patch('/:id/status', taskController.updateStatus);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
