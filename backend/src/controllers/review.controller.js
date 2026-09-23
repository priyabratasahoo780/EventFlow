const Review = require('../models/Review');

exports.createReview = async (req, res) => {
  try {
    const { rating, text } = req.body;
    const userId = req.userId; // from auth middleware

    if (!rating || !text) {
      return res.status(400).json({ message: 'Rating and text are required' });
    }

    const review = new Review({
      rating,
      text,
      user: userId,
    });

    await review.save();
    
    // Populate user info before returning
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
      .sort({ createdAt: -1 }).lean();
      
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const reviewId = req.params.id;
    const userId = req.userId; // from auth middleware

    const review = await Review.findById(reviewId);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    const index = review.likes.indexOf(userId);
    if (index === -1) {
      review.likes.push(userId); // Like
    } else {
      review.likes.splice(index, 1); // Unlike
    }

    await review.save();
    res.json({ likes: review.likes });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
