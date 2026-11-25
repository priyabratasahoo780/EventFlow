/**
 * src/config/socket.js
 * Socket.io setup with JWT authentication and temporary-token rejection.
 */
'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

function getAllowedSocketOrigins() {
  const raw = process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN;
  if (!raw || raw.trim() === '*') return '*';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

/**
 * Attaches socket.io to an existing HTTP server.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: getAllowedSocketOrigins(),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  // JWT authentication middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error: no token provided'));

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) return next(new Error('Server authentication configuration error'));

    try {
      const decoded = jwt.verify(token, jwtSecret);
      if (!decoded || decoded.isTemp) {
        return next(new Error('Authentication error: temporary token rejected'));
      }
      const userId = decoded._id || decoded.id;
      if (!userId) return next(new Error('Authentication error: invalid token payload'));
      socket.userId = userId.toString();
      next();
    } catch (_err) {
      next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id} (User: ${socket.userId})`);
    socket.join(socket.userId);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

module.exports = { setupSocket };
