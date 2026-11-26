'use strict';

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../utils/logger');

function getAllowedSocketOrigins() {
  const raw = process.env.CORS_ORIGIN || process.env.CLIENT_ORIGIN;
  if (!raw || raw.trim() === '*') return '*';
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
}

// Track active socket IDs per userId for real-time online presence
const onlineUsers = new Map();

function isUserOnline(userId) {
  const sockets = onlineUsers.get(String(userId));
  return Boolean(sockets && sockets.size > 0);
}

async function broadcastFriendPresence(io, uid, online) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const user = await User.findById(uid).select('friends').lean();
    if (user?.friends?.length) {
      for (const fid of user.friends) {
        io.to(fid.toString()).emit('user_status', { userId: uid, online });
      }
    }
  } catch (_err) {
    // Non-fatal presence broadcast error
  }
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
    pingTimeout: 25000,
    pingInterval: 10000,
    transports: ['websocket', 'polling'],
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
    const uid = socket.userId;
    logger.info(`Socket connected: ${socket.id} (User: ${uid})`);
    socket.join(uid);

    if (!onlineUsers.has(uid)) {
      onlineUsers.set(uid, new Set());
    }
    const wasOffline = onlineUsers.get(uid).size === 0;
    onlineUsers.get(uid).add(socket.id);

    // Register all handlers synchronously before any async DB calls
    socket.on('check_online', (friendIds, callback) => {
      if (typeof callback !== 'function') return;
      if (!Array.isArray(friendIds)) return callback({});
      const statusMap = {};
      for (const fid of friendIds.slice(0, 100)) {
        statusMap[String(fid)] = isUserOnline(fid);
      }
      callback(statusMap);
    });

    socket.on('typing', ({ to }) => {
      if (to && typeof to === 'string') {
        io.to(to).emit('friend_typing', { from: uid });
      }
    });

    socket.on('stop_typing', ({ to }) => {
      if (to && typeof to === 'string') {
        io.to(to).emit('friend_stop_typing', { from: uid });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
      const set = onlineUsers.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          onlineUsers.delete(uid);
          broadcastFriendPresence(io, uid, false);
        }
      }
    });

    if (wasOffline) {
      broadcastFriendPresence(io, uid, true);
    }
  });

  return io;
}

module.exports = { setupSocket, isUserOnline };
