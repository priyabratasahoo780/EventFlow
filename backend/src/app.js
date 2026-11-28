 
'use strict';

require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
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
const adminRoutes = require('./routes/admin.routes');
const festivalRoutes = require('./routes/festival.routes');

const { apiLimiter } = require('./middleware/rateLimiter');
const monitoringService = require('./services/monitoring.service');

const app = express();

// Trust first reverse proxy (Render/Nginx/Cloudflare) so rate limiters read real client IPs
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Connect Database
connectDB();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow mobile app image/video loading from /uploads
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers capped at 2MB to prevent memory DoS (media uses multipart via multer)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

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

// Static media serving locked down against script/HTML execution & sniffing
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../../uploads'), {
    dotfiles: 'deny',
    index: false,
    maxAge: '7d',
    setHeaders(res) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  })
);

app.use('/api', apiLimiter);
app.use('/api', monitoringService.trackRequestMetrics);

// Health check
app.get(['/', '/api', '/api/health'], (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    db: dbReady ? 'connected' : 'connecting',
    message: 'EventFlow API is running 🚀',
  });
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
app.use('/api/admin', adminRoutes);
app.use('/api/festival', festivalRoutes);

// Standardized JSON 404 for unknown API routes (Express 5 safe)
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Error Handler
app.use(errorMiddleware);

module.exports = app;
