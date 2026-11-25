/**
 * friend.controller.js
 * Hardened friend discovery, request workflows, and friend-verified messaging.
 */
'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Message = require('../models/Message');
const { Expo } = require('expo-server-sdk');

const escapeRegex = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

exports.searchFriend = async (req, res) => {
  try {
    const { uniqueId } = req.body;
    if (!uniqueId || typeof uniqueId !== 'string' || !uniqueId.trim()) {
      return res.status(400).json({ error: 'Please enter a Unique ID, username, or email' });
    }

    const clean = uniqueId.trim().slice(0, 100);
    const cleanNoAt = clean.replace(/^@/, '');
    const escaped = escapeRegex(clean);
    const escapedNoAt = escapeRegex(cleanNoAt);

    const user = await User.findOne({
      $or: [
        { uniqueId: clean },
        { uniqueId: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { username: { $regex: new RegExp(`^${escapedNoAt}$`, 'i') } },
        { email: clean.toLowerCase() },
      ],
    })
      .select('name username profilePhoto uniqueId city friends')
      .lean();

    if (!user) {
      return res.status(404).json({
        error: `User "${clean}" not found. Verify the Unique ID, username, or email.`,
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'This is your own profile' });
    }

    const currentUser = await User.findById(req.user._id);
    const isAlreadyFriend = currentUser?.friends
      ? currentUser.friends.some((f) => f.toString() === user._id.toString())
      : false;

    const pendingRequest = await FriendRequest.findOne({
      $or: [
        { senderId: req.user._id, receiverId: user._id, status: 'pending' },
        { senderId: user._id, receiverId: req.user._id, status: 'pending' },
      ],
    }).lean();

    let relationshipStatus = 'none';
    if (isAlreadyFriend) {
      relationshipStatus = 'already_friends';
    } else if (pendingRequest) {
      relationshipStatus =
        pendingRequest.senderId.toString() === req.user._id.toString() ? 'request_sent' : 'request_received';
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      profilePhoto: user.profilePhoto,
      uniqueId: user.uniqueId,
      city: user.city,
      isAlreadyFriend,
      relationshipStatus,
      requestId: pendingRequest?._id,
    });
  } catch (err) {
    console.error('searchFriend error:', err);
    res.status(500).json({ error: 'Server error while searching user' });
  }
};

exports.sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!isValidId(receiverId)) {
      return res.status(400).json({ error: 'Invalid recipient user ID' });
    }

    if (receiverId.toString() === senderId.toString()) {
      return res.status(400).json({ error: 'You cannot connect with yourself' });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'Recipient user not found' });
    }

    const currentUser = await User.findById(senderId);
    if (currentUser?.friends?.some((f) => f.toString() === receiverId.toString())) {
      return res.status(400).json({ error: 'You are already connected with this friend!' });
    }

    const existingRequest = await FriendRequest.findOne({
      $or: [
        { senderId, receiverId, status: 'pending' },
        { senderId: receiverId, receiverId: senderId, status: 'pending' },
      ],
    }).lean();

    if (existingRequest) {
      if (existingRequest.senderId.toString() === senderId.toString()) {
        return res.status(400).json({ error: 'A friend request is already pending.' });
      }
      return res.status(400).json({ error: 'This user has already sent you a request! Check your Requests tab.' });
    }

    const request = new FriendRequest({ senderId, receiverId, status: 'pending' });
    await request.save();

    if (receiver.expoPushToken && Expo.isExpoPushToken(receiver.expoPushToken)) {
      try {
        const expo = new Expo();
        await expo.sendPushNotificationsAsync([
          {
            to: receiver.expoPushToken,
            sound: 'default',
            title: 'New Friend Request! 👋',
            body: `${currentUser.name} sent you a friend request.`,
            data: { type: 'friend_request' },
          },
        ]);
      } catch (pushErr) {
        console.error('Push notification error:', pushErr);
      }
    }

    res.json({ message: 'Friend request sent successfully!' });
  } catch (err) {
    console.error('sendRequest error:', err);
    res.status(500).json({ error: 'Server error while sending friend request' });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({ receiverId: req.user._id, status: 'pending' })
      .populate('senderId', 'name username profilePhoto uniqueId city')
      .lean();
    res.json(requests);
  } catch (_err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!isValidId(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Friend request has already been processed.' });
    }

    request.status = 'accepted';
    await request.save();

    await User.findByIdAndUpdate(request.senderId, { $addToSet: { friends: request.receiverId } });
    await User.findByIdAndUpdate(request.receiverId, { $addToSet: { friends: request.senderId } });

    res.json({ message: 'Request accepted' });
  } catch (_err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!isValidId(requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }

    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    request.status = 'rejected';
    await request.save();
    res.json({ message: 'Request rejected' });
  } catch (_err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'name username profilePhoto uniqueId city')
      .lean();
    res.json(user?.friends || []);
  } catch (_err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text, type } = req.body;

    if (!isValidId(receiverId)) {
      return res.status(400).json({ error: 'Invalid recipient user ID' });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const cleanText = text.trim().slice(0, 1000);
    const safeType = ['message', 'cheer', 'nudge'].includes(type) ? type : 'message';

    // Only allow messaging confirmed friends
    const sender = await User.findById(req.user._id).select('name username profilePhoto friends');
    const isFriend = sender?.friends?.some((f) => f.toString() === receiverId.toString());
    if (!isFriend) {
      return res.status(403).json({ error: 'You can only send messages to connected friends.' });
    }

    const message = new Message({
      senderId: req.user._id,
      receiverId,
      text: cleanText,
      type: safeType,
    });
    await message.save();

    const receiver = await User.findById(receiverId);

    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('cheer_received', {
        message: message.text,
        type: message.type,
        senderName: sender?.name || 'A friend',
        senderUsername: sender?.username || '',
        senderPhoto: sender?.profilePhoto || '',
        createdAt: message.createdAt,
      });
      io.to(receiverId.toString()).emit('new_message', message);
    }

    if (receiver && receiver.expoPushToken && Expo.isExpoPushToken(receiver.expoPushToken)) {
      try {
        const expo = new Expo();
        await expo.sendPushNotificationsAsync([
          {
            to: receiver.expoPushToken,
            sound: 'default',
            priority: 'high',
            channelId: 'focusflow_alarm_v2',
            title: `📣 ${sender?.name || 'A friend'} cheered you on!`,
            body: cleanText,
            data: {
              type: 'cheer_nudge',
              senderId: req.user._id,
              senderName: sender?.name,
              text: cleanText,
            },
          },
        ]);
      } catch (pushErr) {
        console.error('Cheer push notification error:', pushErr);
      }
    }

    res.json({ message: 'Message sent successfully!', data: message });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Server error while sending message' });
  }
};

exports.getFriendMessages = async (req, res) => {
  try {
    const { friendId } = req.params;
    if (!isValidId(friendId)) {
      return res.status(400).json({ error: 'Invalid friend ID' });
    }

    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: friendId },
        { senderId: friendId, receiverId: req.user._id },
      ],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(messages);
  } catch (_err) {
    res.status(500).json({ error: 'Server error while fetching messages' });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!isValidId(friendId)) {
      return res.status(400).json({ error: 'Invalid friend ID' });
    }

    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: req.user._id } });

    await FriendRequest.deleteMany({
      $or: [
        { senderId: req.user._id, receiverId: friendId },
        { senderId: friendId, receiverId: req.user._id },
      ],
    });

    res.json({ message: 'Friend removed' });
  } catch (_err) {
    res.status(500).json({ error: 'Server error while removing friend' });
  }
};
