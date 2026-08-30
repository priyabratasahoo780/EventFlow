const Event = require('../models/Event');
const { calculatePriorityScore, getPriorityLevel } = require('../services/priority.service');

// Get all tasks for user with dynamic priority scores
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Event.find({
      $or: [
        { ownerId: req.userId },
        { sharedWith: req.userId }
      ]
    }).sort({ date: 1 });
    const tasksWithScores = tasks.map(t => {
      const taskObj = t.toObject();
      taskObj.priorityScore = calculatePriorityScore(taskObj);
      taskObj.priorityDetails = getPriorityLevel(taskObj.priorityScore);
      return taskObj;
    });
    res.json(tasksWithScores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Smart Recommendation ("What Should I Do Now?")
exports.getRecommendation = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    const userLocation = (latitude && longitude) ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) } : null;

    const pendingTasks = await Event.find({
      $or: [
        { ownerId: req.userId },
        { sharedWith: req.userId }
      ],
      completed: false,
      status: { $ne: 'completed' }
    });

    if (pendingTasks.length === 0) {
      return res.json({ recommendation: null, message: "No pending tasks! You are all caught up. 🎉" });
    }

    const scoredTasks = pendingTasks.map(t => {
      const taskObj = t.toObject();
      taskObj.priorityScore = calculatePriorityScore(taskObj, userLocation);
      taskObj.priorityDetails = getPriorityLevel(taskObj.priorityScore);
      return taskObj;
    });

    // Sort descending by priorityScore
    scoredTasks.sort((a, b) => b.priorityScore - a.priorityScore);

    const topTask = scoredTasks[0];
    res.json({
      recommendation: topTask,
      totalPending: pendingTasks.length,
      allScored: scoredTasks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create task
exports.createTask = async (req, res) => {
  try {
    const newTask = new Event({
      ...req.body,
      ownerId: req.userId
    });
    newTask.priorityScore = calculatePriorityScore(newTask.toObject());
    await newTask.save();
    
    const io = req.app.get('io');
    if (io) {
      if (newTask.sharedWith && newTask.sharedWith.length > 0) {
        newTask.sharedWith.forEach(friendId => {
          io.to(friendId.toString()).emit('task_created', newTask);
        });
      }
    }
    
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Event.findOne({ 
      id: req.params.id, 
      $or: [{ ownerId: req.userId }, { sharedWith: req.userId }]
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    
    const taskObj = task.toObject();
    taskObj.priorityScore = calculatePriorityScore(taskObj);
    taskObj.priorityDetails = getPriorityLevel(taskObj.priorityScore);
    res.json(taskObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const updated = await Event.findOneAndUpdate(
      { id: req.params.id, $or: [{ ownerId: req.userId }, { sharedWith: req.userId }] },
      { $set: req.body },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Task not found' });

    const io = req.app.get('io');
    if (io) {
      const emitIds = new Set([updated.ownerId.toString(), ...(updated.sharedWith || []).map(id => id.toString())]);
      emitIds.forEach(id => {
        if (id !== req.userId) { // Don't emit to self (or do, to update UI)
          io.to(id).emit('task_updated', updated);
        }
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update task status (Pending, In Progress, Completed, Overdue, Cancelled)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const completed = status === 'completed';
    
    const setQuery = { status, completed, completedAt: completed ? new Date() : null };
    if (status === 'in_progress') setQuery.startedAt = new Date();

    const updated = await Event.findOneAndUpdate(
      { id: req.params.id, $or: [{ ownerId: req.userId }, { sharedWith: req.userId }] },
      { $set: setQuery },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Task not found' });

    const io = req.app.get('io');
    if (io) {
      const emitIds = new Set([updated.ownerId.toString(), ...(updated.sharedWith || []).map(id => id.toString())]);
      emitIds.forEach(id => {
        if (id !== req.userId) {
          io.to(id).emit('task_updated', updated);
        }
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const deleted = await Event.findOneAndDelete({ 
      id: req.params.id, 
      $or: [{ ownerId: req.userId }, { sharedWith: req.userId }] 
    });
    if (!deleted) return res.status(404).json({ error: 'Task not found' });

    const io = req.app.get('io');
    if (io) {
      const emitIds = new Set([deleted.ownerId.toString(), ...(deleted.sharedWith || []).map(id => id.toString())]);
      emitIds.forEach(id => {
        if (id !== req.userId) {
          io.to(id).emit('task_deleted', req.params.id);
        }
      });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
