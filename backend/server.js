require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const app = require('./src/app');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  try {
    const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_eventflow2026';
    const decoded = jwt.verify(token, jwtSecret);
    socket.userId = decoded._id || decoded.id;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} (User: ${socket.userId})`);
  socket.join(socket.userId);
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.set('io', io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`FocusFlow Backend Server running on port ${PORT} 🚀`);
});
