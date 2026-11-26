
const mongoose = require('mongoose');
const { seedAdminAccount } = require('./seedAdmin');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eventflow';
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 20,
    });
    logger.info('MongoDB Connected Successfully!');
    await seedAdminAccount();
  } catch (err) {
    logger.error('MongoDB Connection Error', err);
  }
};

module.exports = connectDB;
