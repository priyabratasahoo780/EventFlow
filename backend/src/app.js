require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const errorMiddleware = require('./middleware/error.middleware');

const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');

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
// Set security HTTP headers (crossOriginResourcePolicy disabled to allow external mobile app access to /uploads)
app.use(helmet({ crossOriginResourcePolicy: false }));

app.use(cors());

// Data sanitization against NoSQL query injection (Express 5 safe in-place sanitization)
app.use((req, _res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Compress API responses
app.use(compression());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api', apiLimiter);

// Health check
app.get(['/', '/api', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'EventFlow API is running 🚀' });
});

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
