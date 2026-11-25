/**
 * event.controller.js
 * Event creation and friend-shared event feed endpoints.
 */
'use strict';

const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');

exports.createEvent = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    const { id, title, description, date, time, category, priority, visibility, sharedWith, reminders } = req.body;

    if (!id || !title || !date || !time) {
      return res.status(400).json({ error: 'id, title, date, and time are required.' });
    }

    const safeSharedWith = Array.isArray(sharedWith)
      ? sharedWith.filter((uid) => mongoose.Types.ObjectId.isValid(uid))
      : [];

    const event = new Event({
      id: String(id).trim().slice(0, 100),
      title: String(title).trim().slice(0, 200),
      description: typeof description === 'string' ? description.trim().slice(0, 2000) : '',
      date: String(date),
      time: String(time),
      category: typeof category === 'string' ? category.slice(0, 50) : 'Academic',
      priority: ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium',
      visibility: ['onlyMe', 'friends', 'selectedFriends'].includes(visibility) ? visibility : 'onlyMe',
      sharedWith: safeSharedWith,
      reminders: Array.isArray(reminders) ? reminders.slice(0, 20) : [],
      ownerId: userId,
    });

    await event.save();
    res.json(event);
  } catch (_err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    const events = await Event.find({ ownerId: userId }).lean();
    res.json(events);
  } catch (_err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFriendsEvents = async (req, res) => {
  try {
    const userId = req.userId || (req.user && req.user._id);
    if (!userId) {
      return res.json([]);
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.json([]);
    }

    const friendIds = user.friends || [];

    // Find all users who are mutual friends (either current user has them, or they have current user)
    const usersWhoHaveMeAsFriend = await User.find({ friends: userId }).select('_id').lean();
    const allConnectedFriendIds = Array.from(
      new Set([
        ...friendIds.map((f) => f.toString()),
        ...usersWhoHaveMeAsFriend.map((u) => u._id.toString()),
      ])
    );

    const events = await Event.find({
      $or: [
        { ownerId: { $in: allConnectedFriendIds }, visibility: 'friends' },
        { visibility: 'selectedFriends', sharedWith: userId },
      ],
    })
      .populate('ownerId', 'name username profilePhoto uniqueId')
      .lean();

    res.json(events);
  } catch (err) {
    console.error('getFriendsEvents error:', err);
    res.status(500).json({ error: 'Server error while fetching friends events' });
  }
};
