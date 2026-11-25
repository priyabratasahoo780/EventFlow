/**
 * task.controller.js
 * Controller for task lifecycle, dynamic priority scoring, and recommendations.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');
const { Expo } = require('expo-server-sdk');
const { calculatePriorityScore, getPriorityLevel } = require('../services/priority.service');

const MAX_VISIBLE_TASKS = 80;
const CLEANUP_CYCLE_MS = 90 * 24 * 60 * 60 * 1000; // Every 3 months (90 days)
const ARCHIVE_AGE_MS = 45 * 24 * 60 * 60 * 1000;   // Archive tasks older than 1.5 months (45 days)

async function runPeriodicTaskCleanupIfDue(userId) {
  try {
    const user = await User.findById(userId).select('lastTaskCleanupAt');
    if (!user) return 0;

    const now = new Date();
    if (!user.lastTaskCleanupAt) {
      user.lastTaskCleanupAt = now;
      await user.save();
      return 0;
    }

    if (now.getTime() - new Date(user.lastTaskCleanupAt).getTime() < CLEANUP_CYCLE_MS) {
      return 0;
    }

    const cutoffDate = new Date(now.getTime() - ARCHIVE_AGE_MS);
    const result = await Event.updateMany(
      {
        ownerId: userId,
        isArchived: { $ne: true },
        createdAt: { $lte: cutoffDate },
      },
      {
        $set: { isArchived: true, archivedAt: now },
      }
    );

    user.lastTaskCleanupAt = now;
    await user.save();
    return result.modifiedCount || 0;
  } catch (err) {
    console.error('Periodic task cleanup error:', err);
    return 0;
  }
}

const ALLOWED_TASK_FIELDS = [
  'id',
  'title',
  'description',
  'date',
  'time',
  'isAllDay',
  'category',
  'priority',
  'estimatedDuration',
  'status',
  'completed',
  'location',
  'locationDetails',
  'locationReminderEnabled',
  'geofenceRadius',
  'triggerType',
  'locationReminderTriggered',
  'locationTimeGate',
  'pendingExitGeofenceId',
  'isCritical',
  'checklist',
  'image',
  'video',
  'linkedContact',
  'startedAt',
  'completedAt',
  'visibility',
  'sharedWith',
  'reminders',
];

function pickTaskFields(body) {
  const payload = {};
  for (const field of ALLOWED_TASK_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined) {
      payload[field] = body[field];
    }
  }
  return payload;
}

function sanitizeSharedWith(sharedWith, allowedFriendSet) {
  if (!Array.isArray(sharedWith)) return [];
  return sharedWith
    .map((id) => String(id))
    .filter((id) => mongoose.Types.ObjectId.isValid(id) && allowedFriendSet.has(id));
}

// Get all tasks for user with dynamic priority scores
exports.getTasks = async (req, res) => {
  try {
    await runPeriodicTaskCleanupIfDue(req.userId);

    const includeArchived = req.query.includeArchived === 'true';
    const baseOwnership = { $or: [{ ownerId: req.userId }, { sharedWith: req.userId }] };
    const query = includeArchived
      ? baseOwnership
      : { ...baseOwnership, isArchived: { $ne: true } };

    const tasks = await Event.find(query)
      .sort({ date: 1 })
      .lean();

    const tasksWithScores = tasks.map((t) => {
      const taskObj = { ...t };
      taskObj.priorityScore = calculatePriorityScore(taskObj);
      taskObj.priorityDetails = getPriorityLevel(taskObj.priorityScore);
      return taskObj;
    });
    res.json(tasksWithScores);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to load tasks' });
  }
};

// Get Smart Recommendation ("What Should I Do Now?")
exports.getRecommendation = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    const hasValidLocation =
      Number.isFinite(latNum) &&
      Number.isFinite(lngNum) &&
      latNum >= -90 &&
      latNum <= 90 &&
      lngNum >= -180 &&
      lngNum <= 180;

    const userLocation = hasValidLocation ? { latitude: latNum, longitude: lngNum } : null;

    const pendingTasks = await Event.find({
      $or: [{ ownerId: req.userId }, { sharedWith: req.userId }],
      isArchived: { $ne: true },
      completed: false,
      status: { $ne: 'completed' },
    }).lean();

    if (pendingTasks.length === 0) {
      return res.json({ recommendation: null, message: 'No pending tasks! You are all caught up. 🎉' });
    }

    const scoredTasks = pendingTasks.map((t) => {
      const taskObj = { ...t };
      taskObj.priorityScore = calculatePriorityScore(taskObj, userLocation);
      taskObj.priorityDetails = getPriorityLevel(taskObj.priorityScore);
      return taskObj;
    });

    scoredTasks.sort((a, b) => b.priorityScore - a.priorityScore);

    res.json({
      recommendation: scoredTasks[0],
      totalPending: pendingTasks.length,
      allScored: scoredTasks,
    });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
};

// Create task
exports.createTask = async (req, res) => {
  try {
    await runPeriodicTaskCleanupIfDue(req.userId);

    const activeCount = await Event.countDocuments({
      ownerId: req.userId,
      isArchived: { $ne: true },
    });

    if (activeCount >= MAX_VISIBLE_TASKS || (req.body.confirmArchiveOldest === true && req.body.archiveTaskId)) {
      if (activeCount >= MAX_VISIBLE_TASKS && req.body.confirmArchiveOldest !== true) {
        return res.status(409).json({
          requiresArchiveConfirm: true,
          error: `Maximum ${MAX_VISIBLE_TASKS} tasks limit reached. Adding a new task will remove your oldest task from the active screen (Statistics stay saved).`,
        });
      }

      if (req.body.archiveTaskId && typeof req.body.archiveTaskId === 'string') {
        await Event.updateOne(
          { id: req.body.archiveTaskId.trim(), ownerId: req.userId, isArchived: { $ne: true } },
          { $set: { isArchived: true, archivedAt: new Date() } }
        );
      }

      const remainingActive = await Event.countDocuments({
        ownerId: req.userId,
        isArchived: { $ne: true },
      });

      // Ensure active count stays below MAX_VISIBLE_TASKS before inserting the new task
      if (remainingActive >= MAX_VISIBLE_TASKS) {
        const excessCount = remainingActive - (MAX_VISIBLE_TASKS - 1);
        const oldestTasks = await Event.find({
          ownerId: req.userId,
          isArchived: { $ne: true },
        })
          .sort({ createdAt: 1, date: 1 })
          .limit(excessCount)
          .select('_id')
          .lean();

        if (oldestTasks.length > 0) {
          await Event.updateMany(
            { _id: { $in: oldestTasks.map((t) => t._id) } },
            { $set: { isArchived: true, archivedAt: new Date() } }
          );
        }
      }
    }

    const currentUser = await User.findById(req.userId);
    const allowedFriends = new Set((currentUser?.friends || []).map((f) => f.toString()));

    const payload = pickTaskFields(req.body);
    let sharedFriends = sanitizeSharedWith(payload.sharedWith, allowedFriends);

    if (payload.visibility === 'friends' && allowedFriends.size > 0) {
      sharedFriends = Array.from(allowedFriends);
    }

    const newTask = new Event({
      ...payload,
      sharedWith: sharedFriends,
      ownerId: req.userId,
    });
    newTask.priorityScore = calculatePriorityScore(newTask.toObject());
    await newTask.save();

    // 1. Emit real-time Socket event to friends
    const io = req.app.get('io');
    if (io && sharedFriends.length > 0) {
      sharedFriends.forEach((friendId) => {
        io.to(friendId.toString()).emit('task_created', {
          ...newTask.toObject(),
          ownerId: currentUser
            ? { _id: currentUser._id, name: currentUser.name, username: currentUser.username }
            : newTask.ownerId,
        });
      });
    }

    // 2. Send Push Notifications to friends' devices
    if (sharedFriends.length > 0 && currentUser) {
      try {
        const friendsWithTokens = await User.find({
          _id: { $in: sharedFriends },
          expoPushToken: { $exists: true, $ne: '' },
        }).lean();

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
              channelId: 'focusflow_alarm_v2',
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
    res.status(400).json({ error: err.name === 'ValidationError' ? err.message : 'Failed to create task' });
  }
};

// Get single task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await Event.findOne({
      id: req.params.id,
      $or: [{ ownerId: req.userId }, { sharedWith: req.userId }],
    }).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const taskObj = { ...task };
    taskObj.priorityScore = calculatePriorityScore(taskObj);
    taskObj.priorityDetails = getPriorityLevel(taskObj.priorityScore);
    res.json(taskObj);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to load task' });
  }
};

// Update task
exports.updateTask = async (req, res) => {
  try {
    const existingTask = await Event.findOne({
      id: req.params.id,
      $or: [{ ownerId: req.userId }, { sharedWith: req.userId }],
    });
    if (!existingTask) return res.status(404).json({ error: 'Task not found' });

    const isOwner = existingTask.ownerId.toString() === req.userId.toString();
    const updates = pickTaskFields(req.body);
    delete updates.id; // Prevent changing task ID

    // Only task owner may change sharing permissions or visibility
    if (!isOwner) {
      delete updates.visibility;
      delete updates.sharedWith;
    } else if (Object.prototype.hasOwnProperty.call(updates, 'sharedWith')) {
      const currentUser = await User.findById(req.userId).select('friends').lean();
      const allowedFriends = new Set((currentUser?.friends || []).map((f) => f.toString()));
      updates.sharedWith = sanitizeSharedWith(updates.sharedWith, allowedFriends);
    }

    const updated = await Event.findOneAndUpdate(
      { _id: existingTask._id },
      { $set: updates },
      { returnDocument: 'after' }
    );

    const currentUser = await User.findById(req.userId);
    const emitIds = new Set([
      updated.ownerId.toString(),
      ...(updated.sharedWith || []).map((id) => id.toString()),
    ]);

    const io = req.app.get('io');
    if (io) {
      emitIds.forEach((id) => {
        if (id !== req.userId.toString()) {
          io.to(id).emit('task_updated', {
            ...updated.toObject(),
            lastModifiedBy: currentUser ? currentUser.name : 'A team member',
          });
        }
      });
    }

    const otherMembers = Array.from(emitIds).filter((id) => id !== req.userId.toString());
    if (otherMembers.length > 0 && currentUser) {
      try {
        const usersWithTokens = await User.find({
          _id: { $in: otherMembers },
          expoPushToken: { $exists: true, $ne: '' },
        }).lean();

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
              channelId: 'focusflow_alarm_v2',
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
    res.status(400).json({ error: err.name === 'ValidationError' ? err.message : 'Failed to update task' });
  }
};

// Update task status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'late_completed', 'overdue', 'cancelled', 'pending_exit'];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status value "${status}". Must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    const completed = status === 'completed' || status === 'late_completed';
    const setQuery = { status, completed, completedAt: completed ? new Date() : null };
    if (status === 'in_progress') setQuery.startedAt = new Date();

    const updated = await Event.findOneAndUpdate(
      { id: req.params.id, $or: [{ ownerId: req.userId }, { sharedWith: req.userId }] },
      { $set: setQuery },
      { returnDocument: 'after' }
    );
    if (!updated) return res.status(404).json({ error: 'Task not found' });

    const currentUser = await User.findById(req.userId);
    const emitIds = new Set([
      updated.ownerId.toString(),
      ...(updated.sharedWith || []).map((id) => id.toString()),
    ]);

    const io = req.app.get('io');
    if (io) {
      emitIds.forEach((id) => {
        if (id !== req.userId.toString()) {
          io.to(id).emit('task_updated', {
            ...updated.toObject(),
            lastModifiedBy: currentUser ? currentUser.name : 'A team member',
          });
        }
      });
    }

    const otherMembers = Array.from(emitIds).filter((id) => id !== req.userId.toString());
    if (otherMembers.length > 0 && currentUser) {
      try {
        const usersWithTokens = await User.find({
          _id: { $in: otherMembers },
          expoPushToken: { $exists: true, $ne: '' },
        }).lean();

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
              channelId: 'focusflow_alarm_v2',
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
  } catch (_err) {
    res.status(500).json({ error: 'Failed to update task status' });
  }
};

// Delete task
exports.deleteTask = async (req, res) => {
  try {
    const deleted = await Event.findOneAndDelete({
      id: req.params.id,
      $or: [{ ownerId: req.userId }, { sharedWith: req.userId }],
    });
    if (!deleted) return res.status(404).json({ error: 'Task not found' });

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
      const emitIds = new Set([
        deleted.ownerId.toString(),
        ...(deleted.sharedWith || []).map((id) => id.toString()),
      ]);
      emitIds.forEach((id) => {
        if (id !== req.userId.toString()) {
          io.to(id).emit('task_deleted', req.params.id);
        }
      });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

// Geofence Buddy Alert
exports.buddyNearLocation = async (req, res) => {
  try {
    const taskId = req.params.id;
    const friendId = req.userId;

    const task = await Event.findOne({
      id: taskId,
      $or: [{ ownerId: friendId }, { sharedWith: friendId }],
    });
    if (!task) return res.status(404).json({ error: 'Task not found or not shared with you' });

    const friend = await User.findById(friendId).select('name username profilePhoto').lean();
    if (!friend) return res.status(404).json({ error: 'User not found' });

    const allMemberIds = new Set([
      task.ownerId.toString(),
      ...(task.sharedWith || []).map((id) => id.toString()),
    ]);
    allMemberIds.delete(friendId.toString());
    const recipientIds = Array.from(allMemberIds);

    const buddyPayload = {
      type: 'buddy_near_location',
      taskId: task.id || task._id,
      taskTitle: task.title,
      taskLocation: task.location || 'the location',
      taskChecklist: task.checklist || [],
      friendId,
      friendName: friend.name,
      friendUsername: friend.username,
      friendPhoto: friend.profilePhoto || '',
    };

    const io = req.app.get('io');
    if (io) {
      recipientIds.forEach((id) => {
        io.to(id).emit('buddy_near_location', buddyPayload);
      });
    }

    try {
      const expo = new Expo();
      const recipientUsers = await User.find({
        _id: { $in: recipientIds },
        expoPushToken: { $exists: true, $ne: '' },
      }).lean();

      const messages = [];
      for (const recipient of recipientUsers) {
        if (Expo.isExpoPushToken(recipient.expoPushToken)) {
          messages.push({
            to: recipient.expoPushToken,
            sound: 'default',
            title: `🛒 ${friend.name} is near ${task.location || 'the location'}!`,
            body: `Want to add anything to "${task.title}" before they leave?`,
            data: { ...buddyPayload },
            priority: 'high',
            channelId: 'focusflow_alarm_v2',
          });
        }
      }

      if (messages.length > 0) {
        await expo.sendPushNotificationsAsync(messages);
      }
    } catch (pushErr) {
      console.error('[Buddy Alert] Push notification error:', pushErr);
    }

    res.json({ success: true, notified: recipientIds.length });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to trigger buddy alert' });
  }
};
