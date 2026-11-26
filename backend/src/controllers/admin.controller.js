'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Event = require('../models/Event');
const Review = require('../models/Review');
const FriendRequest = require('../models/FriendRequest');
const Message = require('../models/Message');
const FestivalBanner = require('../models/FestivalBanner');
const { deleteFromCloudinary } = require('../config/cloudinary');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const escapeRegex = (str) => String(str || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

function computeReviewStats(reviewsList) {
  const total = reviewsList.length;
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let ratingSum = 0;
  let positiveCount = 0;
  let neutralCount = 0;
  let negativeCount = 0;
  let totalLikes = 0;

  for (const rev of reviewsList) {
    const r = Math.min(5, Math.max(1, Math.round(Number(rev.rating) || 0)));
    breakdown[r] = (breakdown[r] || 0) + 1;
    ratingSum += r;
    totalLikes += Array.isArray(rev.likes) ? rev.likes.length : 0;

    if (r >= 4) positiveCount++;
    else if (r === 3) neutralCount++;
    else negativeCount++;
  }

  return {
    total,
    avgRating: total > 0 ? Number((ratingSum / total).toFixed(1)) : 0,
    positiveCount,
    neutralCount,
    negativeCount,
    positivePercent: total > 0 ? Math.round((positiveCount / total) * 100) : 0,
    neutralPercent: total > 0 ? Math.round((neutralCount / total) * 100) : 0,
    negativePercent: total > 0 ? Math.round((negativeCount / total) * 100) : 0,
    totalLikes,
    breakdown,
  };
}

exports.getOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      bannedUsers,
      twoFactorUsers,
      totalTasks,
      completedTasks,
      allReviewsForStats,
      recentUsers,
      recentReviews,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ twoFactorEnabled: true }),
      Event.countDocuments(),
      Event.countDocuments({ $or: [{ completed: true }, { status: { $in: ['completed', 'late_completed'] } }] }),
      Review.find().select('rating likes').lean(),
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

    const reviewStats = computeReviewStats(allReviewsForStats);

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
        totalReviews: reviewStats.total,
        avgRating: reviewStats.avgRating,
      },
      reviewStats,
      recentUsers,
      recentReviews,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load admin overview' });
  }
};

exports.getReviewStats = async (_req, res) => {
  try {
    const allReviews = await Review.find().select('rating likes').lean();
    res.json(computeReviewStats(allReviews));
  } catch (err) {
    console.error('Admin getReviewStats error:', err);
    res.status(500).json({ error: 'Failed to calculate review statistics' });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const sentiment = String(req.query.sentiment || 'all').toLowerCase();
    const reviews = await Review.find()
      .populate('user', 'name username email profilePhoto role isBanned')
      .sort({ createdAt: -1 })
      .lean();

    const filtered = reviews.filter((r) => {
      if (sentiment === 'positive' && r.rating < 4) return false;
      if (sentiment === 'neutral' && r.rating !== 3) return false;
      if (sentiment === 'negative' && r.rating > 2) return false;

      if (!q) return true;
      const hay = `${r.text || ''} ${r.user?.name || ''} ${r.user?.email || ''} ${r.user?.username || ''}`.toLowerCase();
      return hay.includes(q);
    });

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
      if (evt.image) {
        if (evt.image.startsWith('/uploads/')) {
          fs.unlink(path.join(UPLOAD_DIR, path.basename(evt.image)), () => {});
        } else if (evt.image.includes('res.cloudinary.com')) {
          deleteFromCloudinary(evt.image, 'image').catch(() => {});
        }
      }
      if (evt.video) {
        if (evt.video.startsWith('/uploads/')) {
          fs.unlink(path.join(UPLOAD_DIR, path.basename(evt.video)), () => {});
        } else if (evt.video.includes('res.cloudinary.com')) {
          deleteFromCloudinary(evt.video, 'video').catch(() => {});
        }
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

    if (target.profilePhoto) {
      if (target.profilePhoto.includes('/uploads/')) {
        fs.unlink(path.join(UPLOAD_DIR, path.basename(target.profilePhoto)), () => {});
      } else if (target.profilePhoto.includes('res.cloudinary.com')) {
        deleteFromCloudinary(target.profilePhoto, 'image').catch(() => {});
      }
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User and all associated data deleted.' });
  } catch (err) {
    console.error('Admin deleteUser error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.getTasks = async (_req, res) => {
  return res.status(403).json({
    error: 'Privacy Protection: Admins are strictly prohibited from viewing user tasks.',
  });
};

exports.deleteTask = async (_req, res) => {
  return res.status(403).json({
    error: 'Privacy Protection: Admins cannot access or modify user tasks.',
  });
};

// ── Festival Greeting Cards ─────────────────────────────────────

function parseOptionalDate(val, endOfDay = false) {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  const trimmed = val.trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`)
    : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

exports.getFestivalBanners = async (_req, res) => {
  try {
    const banners = await FestivalBanner.find().sort({ createdAt: -1 }).limit(30).lean();
    res.json(banners);
  } catch (err) {
    console.error('Admin getFestivalBanners error:', err);
    res.status(500).json({ error: 'Failed to load festival cards' });
  }
};

exports.createFestivalBanner = async (req, res) => {
  try {
    const { title, imageUrl, greeting, startDate, endDate, isActive } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Festival title is required.' });
    }
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return res.status(400).json({ error: 'Please upload a festival photo.' });
    }
    if (!greeting || typeof greeting !== 'string' || !greeting.trim()) {
      return res.status(400).json({ error: 'Festival greeting message is required.' });
    }

    const cleanImage = imageUrl.trim().slice(0, 1000);
    if (cleanImage.toLowerCase().startsWith('javascript:')) {
      return res.status(400).json({ error: 'Invalid image URL.' });
    }

    const parsedStart = parseOptionalDate(startDate, false);
    const parsedEnd = parseOptionalDate(endDate, true);
    if (parsedStart && parsedEnd && parsedEnd <= parsedStart) {
      return res.status(400).json({ error: 'End date & time must be after start date & time.' });
    }

    const activeFlag = isActive !== false;
    if (activeFlag) {
      // Deactivate previous active festival banners so the newly published one leads
      await FestivalBanner.updateMany({ isActive: true }, { $set: { isActive: false } });
    }

    const banner = new FestivalBanner({
      title: title.trim().slice(0, 100),
      imageUrl: cleanImage,
      greeting: greeting.trim().slice(0, 500),
      startDate: parsedStart,
      endDate: parsedEnd,
      isActive: activeFlag,
      createdBy: req.userId,
    });

    await banner.save();
    req.app.get('io')?.emit('festival_updated', { active: banner.isActive });
    res.status(201).json(banner);
  } catch (err) {
    console.error('Admin createFestivalBanner error:', err);
    res.status(500).json({ error: 'Failed to publish festival card' });
  }
};

exports.toggleFestivalBanner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid festival card ID' });
    }

    const banner = await FestivalBanner.findById(id);
    if (!banner) {
      return res.status(404).json({ error: 'Festival card not found' });
    }

    const nextActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : !banner.isActive;
    if (nextActive) {
      await FestivalBanner.updateMany({ _id: { $ne: banner._id }, isActive: true }, { $set: { isActive: false } });
    }

    banner.isActive = nextActive;
    await banner.save();
    req.app.get('io')?.emit('festival_updated', { active: banner.isActive });
    res.json(banner);
  } catch (err) {
    console.error('Admin toggleFestivalBanner error:', err);
    res.status(500).json({ error: 'Failed to toggle festival card' });
  }
};

exports.deleteFestivalBanner = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
      return res.status(400).json({ error: 'Invalid festival card ID' });
    }

    const deleted = await FestivalBanner.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Festival card not found' });
    }

    if (deleted.imageUrl) {
      if (deleted.imageUrl.includes('/uploads/')) {
        fs.unlink(path.join(UPLOAD_DIR, path.basename(deleted.imageUrl)), () => {});
      } else if (deleted.imageUrl.includes('res.cloudinary.com')) {
        deleteFromCloudinary(deleted.imageUrl, 'image').catch(() => {});
      }
    }

    req.app.get('io')?.emit('festival_updated', { active: false });
    res.json({ success: true, message: 'Festival card deleted' });
  } catch (err) {
    console.error('Admin deleteFestivalBanner error:', err);
    res.status(500).json({ error: 'Failed to delete festival card' });
  }
};

exports.getActiveFestivalBanner = async (_req, res) => {
  try {
    const now = new Date();
    const active = await FestivalBanner.findOne({
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    })
      .sort({ createdAt: -1 })
      .select('title imageUrl greeting startDate endDate createdAt')
      .lean();

    res.json({ banner: active || null });
  } catch (err) {
    console.error('getActiveFestivalBanner error:', err);
    res.status(500).json({ error: 'Failed to fetch active festival greeting' });
  }
};

// ── Admin Profile & Password Management ─────────────────────────

function validateStrongAdminPassword(pwd) {
  if (!pwd || typeof pwd !== 'string' || pwd.length < 8 || pwd.length > 128) {
    return 'Password must be between 8 and 128 characters long.';
  }
  if (!/[A-Z]/.test(pwd)) return 'Password must include an uppercase letter (A-Z).';
  if (!/[a-z]/.test(pwd)) return 'Password must include a lowercase letter (a-z).';
  if (!/[0-9]/.test(pwd)) return 'Password must include a number (0-9).';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
    return 'Password must include a special character (e.g. @, #, $, !).';
  }
  return null;
}

exports.updateAdminProfile = async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.name === 'string') {
      const cleanName = req.body.name.trim().slice(0, 80);
      if (!cleanName) {
        return res.status(400).json({ error: 'Admin name cannot be empty.' });
      }
      updates.name = cleanName;
    }

    if (typeof req.body.profilePhoto === 'string') {
      const photo = req.body.profilePhoto.trim().slice(0, 500);
      if (photo.toLowerCase().startsWith('javascript:') || photo.toLowerCase().startsWith('data:text/html')) {
        return res.status(400).json({ error: 'Invalid profile photo URL.' });
      }
      updates.profilePhoto = photo;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid profile fields provided.' });
    }

    const updated = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { returnDocument: 'after' }
    ).select('-password -twoFactorOtp -resetPasswordOtp');

    if (!updated) return res.status(404).json({ error: 'Admin account not found.' });
    res.json({ message: 'Admin profile updated.', user: updated });
  } catch (err) {
    console.error('updateAdminProfile error:', err);
    res.status(500).json({ error: 'Failed to update admin profile.' });
  }
};

exports.changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    const pwdError = validateStrongAdminPassword(newPassword);
    if (pwdError) {
      return res.status(400).json({ error: pwdError });
    }

    const adminUser = await User.findById(req.userId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const matchesCurrent = await bcrypt.compare(currentPassword, adminUser.password);
    if (!matchesCurrent) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const isSame = await bcrypt.compare(newPassword, adminUser.password);
    if (isSame) {
      return res.status(400).json({ error: 'New password must be different from current password.' });
    }

    const salt = await bcrypt.genSalt(12);
    adminUser.password = await bcrypt.hash(newPassword, salt);
    await adminUser.save();

    res.json({ success: true, message: 'Admin password changed successfully.' });
  } catch (err) {
    console.error('changeAdminPassword error:', err);
    res.status(500).json({ error: 'Failed to change admin password.' });
  }
};

exports.verifyAdminPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }

    const adminUser = await User.findById(req.userId).select('password role');
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const valid = await bcrypt.compare(password, adminUser.password);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect Admin password.' });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('verifyAdminPassword error:', err);
    res.status(500).json({ error: 'Failed to verify password.' });
  }
};
