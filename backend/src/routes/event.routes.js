/**
 * event.routes.js
 * Express routing definitions for event management endpoints.
 */
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/event.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/', eventController.createEvent);
router.get('/', eventController.getEvents);
router.get('/friends', eventController.getFriendsEvents);

module.exports = router;
