const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const eventController = require('../controllers/eventController');
const auth = require('../middleware/auth');

const { searchLimiter } = require('../middleware/rateLimiter');

router.use(auth);

router.post('/search', searchLimiter, friendController.searchFriend);
router.post('/request', friendController.sendRequest);
router.get('/requests', friendController.getRequests);
router.post('/accept', friendController.acceptRequest);
router.post('/reject', friendController.rejectRequest);
router.get('/', friendController.getFriends);
router.get('/events', eventController.getFriendsEvents);
router.post('/message', friendController.sendMessage);
router.get('/messages/:friendId', friendController.getFriendMessages);
router.delete('/remove', friendController.removeFriend);

module.exports = router;
