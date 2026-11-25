/**
 * review.controller.js
 * Community reviews creation, feed listing, and validated like toggling.
 */
'use strict';

const mongoose = require('mongoose');
const Review = require('../models/Review');

exports.createReview = async (req, res) => {
  try {
    const { rating, text } = req.body;
    const userId = req.userId;

    const numRating = Number(rating);
    if (!Number.isFinite(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ message: 'Review text is required' });
    }

    const review = new Review({
      rating: Math.round(numRating),
      text: text.trim().slice(0, 1000),
      user: userId,
    });

    await review.save();
    await review.populate('user', 'name profilePhoto');

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .lean();

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(String(reviewId || ''))) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const index = review.likes.indexOf(userId);
    if (index === -1) {
      review.likes.push(userId);
    } else {
      review.likes.splice(index, 1);
    }

    await review.save();
    res.json({ likes: review.likes });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
