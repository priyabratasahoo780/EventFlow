
'use strict';

const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Event = require('../models/Event');
const FriendRequest = require('../models/FriendRequest');
const Message = require('../models/Message');
const Review = require('../models/Review');
const { Expo } = require('expo-server-sdk');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const isSafeUri = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim().toLowerCase();
  return !trimmed.startsWith('javascript:') && !trimmed.startsWith('data:text/html');
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to load profile' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = {};

    if (typeof req.body.name === 'string') {
      const cleanName = req.body.name.trim().slice(0, 80);
      if (!cleanName) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      updates.name = cleanName;
    }

    if (typeof req.body.city === 'string') {
      updates.city = req.body.city.trim().slice(0, 80);
    }

    if (typeof req.body.profilePhoto === 'string') {
      if (!isSafeUri(req.body.profilePhoto)) {
        return res.status(400).json({ error: 'Invalid profile photo URL' });
      }
      updates.profilePhoto = req.body.profilePhoto.trim().slice(0, 500);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid profile fields provided to update' });
    }

    const updated = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { returnDocument: 'after' }
    ).select('-password');

    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (_err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

exports.updatePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (token !== '' && (typeof token !== 'string' || !Expo.isExpoPushToken(token))) {
      return res.status(400).json({ error: 'Invalid Expo push token format' });
    }

    await User.findByIdAndUpdate(req.userId || req.user._id, {
      $set: { expoPushToken: token },
    });
    res.json({ message: 'Token updated' });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to update push token' });
  }
};


  // Permanently delete user account and cascade clean all personal data (Play Store / App Store compliance).
 
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // 1. Delete all tasks/events owned by user and clean up local media
    const userEvents = await Event.find({ ownerId: userId }).select('image video').lean();
    for (const evt of userEvents) {
      if (evt.image && evt.image.startsWith('/uploads/')) {
        const filePath = path.join(UPLOAD_DIR, path.basename(evt.image));
        fs.unlink(filePath, () => {});
      }
      if (evt.video && evt.video.startsWith('/uploads/')) {
        const filePath = path.join(UPLOAD_DIR, path.basename(evt.video));
        fs.unlink(filePath, () => {});
      }
    }
    await Event.deleteMany({ ownerId: userId });

    // 2. Remove user from other users' shared task lists
    await Event.updateMany({ sharedWith: userId }, { $pull: { sharedWith: userId } });

    // 3. Delete friend requests sent or received
    await FriendRequest.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    // 4. Remove user from all friends' friend lists
    await User.updateMany({ friends: userId }, { $pull: { friends: userId } });

    // 5. Delete direct messages sent or received
    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    // 6. Delete reviews written by user and remove user's likes
    await Review.deleteMany({ user: userId });
    await Review.updateMany({ likes: userId }, { $pull: { likes: userId } });

    // 7. Delete user's profile photo if stored locally
    if (user.profilePhoto && user.profilePhoto.includes('/uploads/')) {
      const photoPath = path.join(UPLOAD_DIR, path.basename(user.profilePhoto));
      fs.unlink(photoPath, () => {});
    }

    // 8. Delete user account record
    await User.findByIdAndDelete(userId);

    res.json({ success: true, message: 'Account and associated data deleted permanently.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }
};
