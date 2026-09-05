const Event = require('../models/Event');
const User = require('../models/User');

exports.createEvent = async (req, res) => {
  try {
    const { id, title, description, date, time, category, priority, visibility, sharedWith, reminders } = req.body;
    
    const event = new Event({
      id, title, description, date, time, category, priority, 
      visibility, sharedWith, reminders: reminders || [], ownerId: req.user._id
    });
    
    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getEvents = async (req, res) => {
  try {
    const events = await Event.find({ ownerId: req.user._id });
    res.json(events);
  } catch (err) {
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
    const usersWhoHaveMeAsFriend = await User.find({ friends: userId }).select('_id');
    const allConnectedFriendIds = Array.from(new Set([
      ...friendIds.map(f => f.toString()),
      ...usersWhoHaveMeAsFriend.map(u => u._id.toString())
    ]));

    // Find events where:
    // 1. owner is any connected friend AND visibility is 'friends'
    // 2. OR visibility is 'selectedFriends' and we are in sharedWith array
    const events = await Event.find({
      $or: [
        { ownerId: { $in: allConnectedFriendIds }, visibility: 'friends' },
        { visibility: 'selectedFriends', sharedWith: userId }
      ]
    }).populate('ownerId', 'name username profilePhoto uniqueId');

    res.json(events);
  } catch (err) {
    console.error('getFriendsEvents error:', err);
    res.status(500).json({ error: 'Server error while fetching friends events' });
  }
};
