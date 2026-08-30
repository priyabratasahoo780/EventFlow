const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

const escapeRegex = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

exports.searchFriend = async (req, res) => {
  try {
    const { uniqueId } = req.body;
    if (!uniqueId || !uniqueId.trim()) {
      return res.status(400).json({ error: 'Please enter a Unique ID, username, or email' });
    }

    const clean = uniqueId.trim();
    const cleanNoAt = clean.replace(/^@/, '');
    const escaped = escapeRegex(clean);
    const escapedNoAt = escapeRegex(cleanNoAt);

    const user = await User.findOne({
      $or: [
        { uniqueId: clean },
        { uniqueId: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { username: { $regex: new RegExp(`^${escapedNoAt}$`, 'i') } },
        { email: clean.toLowerCase() }
      ]
    }).select('name username profilePhoto uniqueId city friends');

    if (!user) {
      return res.status(404).json({ 
        error: `User "${clean}" not found. Verify the Unique ID (e.g. ${clean}), username, or email.` 
      });
    }
    
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'This is your own profile' });
    }
    
    // Check if already friends
    const currentUser = await User.findById(req.user._id);
    const isAlreadyFriend = currentUser?.friends ? currentUser.friends.some(f => f.toString() === user._id.toString()) : false;
    
    // Check for pending request
    const pendingRequest = await FriendRequest.findOne({
      $or: [
        { senderId: req.user._id, receiverId: user._id, status: 'pending' },
        { senderId: user._id, receiverId: req.user._id, status: 'pending' }
      ]
    });

    let relationshipStatus = 'none';
    if (isAlreadyFriend) {
      relationshipStatus = 'already_friends';
    } else if (pendingRequest) {
      relationshipStatus = pendingRequest.senderId.toString() === req.user._id.toString() ? 'request_sent' : 'request_received';
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
      requestId: pendingRequest?._id
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

    if (receiverId.toString() === senderId.toString()) {
      return res.status(400).json({ error: 'You cannot connect with yourself' });
    }

    // Check if already friends
    const currentUser = await User.findById(senderId);
    if (currentUser.friends && currentUser.friends.some(f => f.toString() === receiverId.toString())) {
      return res.status(400).json({ error: 'You are already connected with this friend!' });
    }

    const existingRequest = await FriendRequest.findOne({
      $or: [
        { senderId, receiverId, status: 'pending' },
        { senderId: receiverId, receiverId: senderId, status: 'pending' }
      ]
    });

    if (existingRequest) {
      if (existingRequest.senderId.toString() === senderId.toString()) {
        return res.status(400).json({ error: 'A friend request is already pending.' });
      } else {
        return res.status(400).json({ error: 'This user has already sent you a request! Check your Requests tab.' });
      }
    }

    const request = new FriendRequest({ senderId, receiverId, status: 'pending' });
    await request.save();

    // Send push notification using Expo Server SDK
    const receiver = await User.findById(receiverId);
    if (receiver && receiver.expoPushToken) {
      const { Expo } = require('expo-server-sdk');
      const expo = new Expo();
      if (Expo.isExpoPushToken(receiver.expoPushToken)) {
        try {
          await expo.sendPushNotificationsAsync([{
            to: receiver.expoPushToken,
            sound: 'default',
            title: 'New Friend Request! 👋',
            body: `${currentUser.name} sent you a friend request.`,
            data: { type: 'friend_request' }
          }]);
        } catch (pushErr) {
          console.error('Push notification error:', pushErr);
        }
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
      .populate('senderId', 'name username profilePhoto uniqueId city');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await FriendRequest.findById(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.receiverId.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Unauthorized' });

    request.status = 'accepted';
    await request.save();

    await User.findByIdAndUpdate(request.senderId, { $push: { friends: request.receiverId } });
    await User.findByIdAndUpdate(request.receiverId, { $push: { friends: request.senderId } });

    res.json({ message: 'Request accepted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await FriendRequest.findById(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.receiverId.toString() !== req.user._id.toString()) return res.status(403).json({ error: 'Unauthorized' });

    request.status = 'rejected';
    await request.save();
    res.json({ message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFriends = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends', 'name username profilePhoto uniqueId city');
    res.json(user.friends);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, text, type } = req.body;
    const Message = require('../models/Message');

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const message = new Message({
      senderId: req.user._id,
      receiverId,
      text: text.trim(),
      type: type || 'message'
    });

    await message.save();
    res.json({ message: 'Message sent successfully!', data: message });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Server error while sending message' });
  }
};

exports.getFriendMessages = async (req, res) => {
  try {
    const { friendId } = req.params;
    const Message = require('../models/Message');

    const messages = await Message.find({
      $or: [
        { senderId: req.user._id, receiverId: friendId },
        { senderId: friendId, receiverId: req.user._id }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error while fetching messages' });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    await User.findByIdAndUpdate(req.user._id, { $pull: { friends: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friends: req.user._id } });

    // Also remove requests
    await FriendRequest.deleteMany({
      $or: [
        { senderId: req.user._id, receiverId: friendId },
        { senderId: friendId, receiverId: req.user._id }
      ]
    });

    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error while removing friend' });
  }
};


