/**
 * server.js
 * EventFlow backend HTTP server and WebSocket entry point.
 */
require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const { validateEnv } = require('./src/config/env');
const { setupSocket } = require('./src/config/socket');
const { verifyEmailTransport } = require('./src/services/email.service');
const logger = require('./src/utils/logger');

// Fail fast if any required env vars are missing
const env = validateEnv();

const app = require('./src/app');

const server = http.createServer(app);

// Attach socket.io
const io = setupSocket(server);
app.set('io', io);

// Start listening
server.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`EventFlow Backend running on port ${env.PORT} [${env.NODE_ENV}]`);
  verifyEmailTransport().catch(() => {});
});

// Graceful shutdown on container / process signals
let isShuttingDown = false;
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.warn(`Received ${signal}. Closing EventFlow server gracefully...`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    if (io) await new Promise((resolve) => io.close(() => resolve()));
    await new Promise((resolve) => server.close(() => resolve()));
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
    }
    logger.info('EventFlow server closed cleanly.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during graceful shutdown', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', reason instanceof Error ? reason : { reason: String(reason) });
});
