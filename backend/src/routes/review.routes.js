const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const userOnly = require('../middleware/userOnly.middleware');
const reviewController = require('../controllers/review.controller');

router.use(authMiddleware);

router.post('/', userOnly, reviewController.createReview);
router.get('/', reviewController.getReviews);
router.post('/:id/like', userOnly, reviewController.toggleLike);
router.delete('/:id', reviewController.deleteReview);

module.exports = router;
