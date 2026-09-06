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

const User = require('../models/User');
const { Expo } = require('expo-server-sdk');

// Create task
exports.createTask = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    let sharedFriends = req.body.sharedWith || [];

    // If visibility is 'friends', auto-share with all connected friends
    if (req.body.visibility === 'friends' && currentUser && currentUser.friends && currentUser.friends.length > 0) {
      sharedFriends = currentUser.friends.map(f => f.toString());
    }

    const newTask = new Event({
      ...req.body,
      sharedWith: sharedFriends,
      ownerId: req.userId
    });
    newTask.priorityScore = calculatePriorityScore(newTask.toObject());
    await newTask.save();
    
    // 1. Emit real-time Socket event to friends
    const io = req.app.get('io');
    if (io && sharedFriends.length > 0) {
      sharedFriends.forEach(friendId => {
        io.to(friendId.toString()).emit('task_created', {
          ...newTask.toObject(),
          ownerId: currentUser ? { _id: currentUser._id, name: currentUser.name, username: currentUser.username } : newTask.ownerId
        });
      });
    }

    // 2. Send Push Notifications to friends' devices
    if (sharedFriends.length > 0 && currentUser) {
      try {
        const friendsWithTokens = await User.find({
          _id: { $in: sharedFriends },
          expoPushToken: { $exists: true, $ne: '' }
        });

        const messages = [];
        const expo = new Expo();

        for (const friend of friendsWithTokens) {
          if (Expo.isExpoPushToken(friend.expoPushToken)) {
            messages.push({
              to: friend.expoPushToken,
              sound: 'default',
              title: `👥 ${currentUser.name} shared an Event!`,
              body: `"${newTask.title}" at ${newTask.time}. Reminder & Alarm are scheduled on your phone!`,
              data: { eventId: newTask.id, type: 'shared_event' },
              priority: 'high',
              channelId: 'focusflow_alarm_v2'
            });
          }
        }

        if (messages.length > 0) {
          await expo.sendPushNotificationsAsync(messages);
        }
      } catch (pushErr) {
        console.error('Shared event push notification error:', pushErr);
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

    const currentUser = await User.findById(req.userId);
    const emitIds = new Set([updated.ownerId.toString(), ...(updated.sharedWith || []).map(id => id.toString())]);

    // 1. Socket real-time event
    const io = req.app.get('io');
    if (io) {
      emitIds.forEach(id => {
        if (id !== req.userId.toString()) {
          io.to(id).emit('task_updated', {
            ...updated.toObject(),
            lastModifiedBy: currentUser ? currentUser.name : 'A team member'
          });
        }
      });
    }

    // 2. Send Push Notification to all other group members
    const otherMembers = Array.from(emitIds).filter(id => id !== req.userId.toString());
    if (otherMembers.length > 0 && currentUser) {
      try {
        const usersWithTokens = await User.find({
          _id: { $in: otherMembers },
          expoPushToken: { $exists: true, $ne: '' }
        });

        const messages = [];
        const expo = new Expo();

        for (const member of usersWithTokens) {
          if (Expo.isExpoPushToken(member.expoPushToken)) {
            messages.push({
              to: member.expoPushToken,
              sound: 'default',
              title: `✏️ ${currentUser.name} updated an Event!`,
              body: `"${updated.title}" has been modified (Time: ${updated.time}).`,
              data: { eventId: updated.id, type: 'task_updated' },
              priority: 'high',
              channelId: 'focusflow_alarm_v2'
            });
          }
        }

        if (messages.length > 0) {
          await expo.sendPushNotificationsAsync(messages);
        }
      } catch (pushErr) {
        console.error('Update task push notification error:', pushErr);
      }
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

    const currentUser = await User.findById(req.userId);
    const emitIds = new Set([updated.ownerId.toString(), ...(updated.sharedWith || []).map(id => id.toString())]);

    const io = req.app.get('io');
    if (io) {
      emitIds.forEach(id => {
        if (id !== req.userId.toString()) {
          io.to(id).emit('task_updated', {
            ...updated.toObject(),
            lastModifiedBy: currentUser ? currentUser.name : 'A team member'
          });
        }
      });
    }

    // Send push notification for status change
    const otherMembers = Array.from(emitIds).filter(id => id !== req.userId.toString());
    if (otherMembers.length > 0 && currentUser) {
      try {
        const usersWithTokens = await User.find({
          _id: { $in: otherMembers },
          expoPushToken: { $exists: true, $ne: '' }
        });

        const statusLabel = status === 'completed' ? 'COMPLETED ✅' : status === 'in_progress' ? 'STARTED ⚡' : status.toUpperCase();
        const messages = [];
        const expo = new Expo();

        for (const member of usersWithTokens) {
          if (Expo.isExpoPushToken(member.expoPushToken)) {
            messages.push({
              to: member.expoPushToken,
              sound: 'default',
              title: `📢 Task Status: ${statusLabel}`,
              body: `${currentUser.name} marked "${updated.title}" as ${status.replace('_', ' ')}.`,
              data: { eventId: updated.id, type: 'task_status_updated' },
              priority: 'high',
              channelId: 'focusflow_alarm_v2'
            });
          }
        }

        if (messages.length > 0) {
          await expo.sendPushNotificationsAsync(messages);
        }
      } catch (pushErr) {
        console.error('Status update push notification error:', pushErr);
      }
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

    // Clean up associated media files from server storage
    const fs = require('fs');
    const path = require('path');
    
    if (deleted.image && deleted.image.startsWith('/uploads/')) {
      const imagePath = path.join(__dirname, '../../uploads', path.basename(deleted.image));
      fs.unlink(imagePath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('Error deleting image file:', err);
      });
    }

    if (deleted.video && deleted.video.startsWith('/uploads/')) {
      const videoPath = path.join(__dirname, '../../uploads', path.basename(deleted.video));
      fs.unlink(videoPath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('Error deleting video file:', err);
      });
    }

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
