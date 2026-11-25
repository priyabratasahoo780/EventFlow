// EventFlow API Server Entry Point
require('dotenv').config();

const http = require('http');
const { validateEnv } = require('./src/config/env');
const { setupSocket } = require('./src/config/socket');
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
});
