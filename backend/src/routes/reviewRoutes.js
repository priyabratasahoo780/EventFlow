const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const reviewController = require('../controllers/review.controller');

router.use(authMiddleware);

router.post('/', reviewController.createReview);
router.get('/', reviewController.getReviews);
router.post('/:id/like', reviewController.toggleLike);

module.exports = router;
