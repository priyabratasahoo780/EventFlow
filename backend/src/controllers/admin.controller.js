/**
 * admin.controller.js
 * Admin portal endpoints for platform overview, community moderation, user management, and task moderation.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Review = require('../models/Review');
const FriendRequest = require('../models/FriendRequest');
const Message = require('../models/Message');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const escapeRegex = (str) => String(str || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

exports.getOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      bannedUsers,
      twoFactorUsers,
      totalTasks,
      completedTasks,
      totalReviews,
      ratingAgg,
      recentUsers,
      recentReviews,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ twoFactorEnabled: true }),
      Event.countDocuments(),
      Event.countDocuments({ $or: [{ completed: true }, { status: { $in: ['completed', 'late_completed'] } }] }),
      Review.countDocuments(),
      Review.aggregate([{ $group: { _id: null, avgRating: { $avg: '$rating' } } }]),
      User.find()
        .select('name username email uniqueId role isBanned twoFactorEnabled profilePhoto createdAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Review.find()
        .populate('user', 'name username email profilePhoto')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const avgRating = ratingAgg[0]?.avgRating ? Number(ratingAgg[0].avgRating.toFixed(1)) : 0;

    res.json({
      admin: {
        _id: req.adminUser._id,
        name: req.adminUser.name,
        email: req.adminUser.email,
      },
      stats: {
        totalUsers,
        bannedUsers,
        twoFactorUsers,
        totalTasks,
        completedTasks,
        totalReviews,
        avgRating,
      },
      recentUsers,
      recentReviews,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const reviews = await Review.find()
      .populate('user', 'name username email profilePhoto role isBanned')
      .sort({ createdAt: -1 })
      .lean();

    const filtered = q
      ? reviews.filter((r) => {
          const hay = `${r.text || ''} ${r.user?.name || ''} ${r.user?.email || ''} ${r.user?.username || ''}`.toLowerCase();
          return hay.includes(q.toLowerCase());
        })
      : reviews;

    res.json(filtered);
  } catch (err) {
    console.error('Admin getAllReviews error:', err);
    res.status(500).json({ error: 'Failed to load community reviews' });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid review ID' });
    }

    const deleted = await Review.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ success: true, message: 'Community comment deleted by admin', id });
  } catch (err) {
    console.error('Admin deleteReview error:', err);
    res.status(500).json({ error: 'Failed to delete review' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = q
      ? {
          $or: [
            { name: { $regex: escapeRegex(q), $options: 'i' } },
            { username: { $regex: escapeRegex(q), $options: 'i' } },
            { email: { $regex: escapeRegex(q), $options: 'i' } },
            { uniqueId: { $regex: escapeRegex(q), $options: 'i' } },
          ],
        }
      : {};

    const users = await User.find(filter)
      .select('name username email uniqueId city profilePhoto role isBanned twoFactorEnabled createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const userIds = users.map((u) => u._id);
    const taskCounts = await Event.aggregate([
      { $match: { ownerId: { $in: userIds } } },
      { $group: { _id: '$ownerId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(taskCounts.map((c) => [c._id.toString(), c.count]));

    const enriched = users.map((u) => ({
      ...u,
      taskCount: countMap.get(u._id.toString()) || 0,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Admin getUsers error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

exports.toggleBanUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (id === req.userId.toString()) {
      return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Cannot suspend an administrator account.' });
    }

    const nextBan = typeof req.body?.banned === 'boolean' ? req.body.banned : !target.isBanned;
    target.isBanned = nextBan;
    await target.save();

    res.json({
      success: true,
      isBanned: target.isBanned,
      message: target.isBanned ? `User ${target.name} suspended.` : `User ${target.name} restored.`,
    });
  } catch (err) {
    console.error('Admin toggleBanUser error:', err);
    res.status(500).json({ error: 'Failed to update user status' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (id === req.userId.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own admin account from here.' });
    }

    const target = await User.findById(id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete an administrator account.' });
    }

    const userEvents = await Event.find({ ownerId: id }).select('image video').lean();
    for (const evt of userEvents) {
      if (evt.image && evt.image.startsWith('/uploads/')) {
        fs.unlink(path.join(UPLOAD_DIR, path.basename(evt.image)), () => {});
      }
      if (evt.video && evt.video.startsWith('/uploads/')) {
        fs.unlink(path.join(UPLOAD_DIR, path.basename(evt.video)), () => {});
      }
    }

    await Promise.all([
      Event.deleteMany({ ownerId: id }),
      Event.updateMany({ sharedWith: id }, { $pull: { sharedWith: id } }),
      FriendRequest.deleteMany({ $or: [{ senderId: id }, { receiverId: id }] }),
      User.updateMany({ friends: id }, { $pull: { friends: id } }),
      Message.deleteMany({ $or: [{ senderId: id }, { receiverId: id }] }),
      Review.deleteMany({ user: id }),
      Review.updateMany({ likes: id }, { $pull: { likes: id } }),
    ]);

    if (target.profilePhoto && target.profilePhoto.includes('/uploads/')) {
      fs.unlink(path.join(UPLOAD_DIR, path.basename(target.profilePhoto)), () => {});
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User and all associated data deleted.' });
  } catch (err) {
    console.error('Admin deleteUser error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const filter = q
      ? {
          $or: [
            { title: { $regex: escapeRegex(q), $options: 'i' } },
            { category: { $regex: escapeRegex(q), $options: 'i' } },
            { location: { $regex: escapeRegex(q), $options: 'i' } },
          ],
        }
      : {};

    const tasks = await Event.find(filter)
      .populate('ownerId', 'name username email')
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    res.json(tasks);
  } catch (err) {
    console.error('Admin getTasks error:', err);
    res.status(500).json({ error: 'Failed to load platform tasks' });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(String(id || ''))
      ? { $or: [{ _id: id }, { id }] }
      : { id };

    const deleted = await Event.findOneAndDelete(query);
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (deleted.image && deleted.image.startsWith('/uploads/')) {
      fs.unlink(path.join(UPLOAD_DIR, path.basename(deleted.image)), () => {});
    }
    if (deleted.video && deleted.video.startsWith('/uploads/')) {
      fs.unlink(path.join(UPLOAD_DIR, path.basename(deleted.video)), () => {});
    }

    res.json({ success: true, message: 'Task removed by admin' });
  } catch (err) {
    console.error('Admin deleteTask error:', err);
    res.status(500).json({ error: 'Failed to remove task' });
  }
};
