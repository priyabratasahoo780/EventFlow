require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorMiddleware = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const friendRoutes = require('./routes/friend.routes');
const eventRoutes = require('./routes/event.routes');
const taskRoutes = require('./routes/task.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const uploadRoutes = require('./routes/upload.routes');
const userRoutes = require('./routes/user.routes');
const reviewRoutes = require('./routes/review.routes');

const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Connect Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);

// Error Handler
app.use(errorMiddleware);

module.exports = app;
