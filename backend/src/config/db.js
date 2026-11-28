
const mongoose = require('mongoose');
const { seedAdminAccount } = require('./seedAdmin');
const logger = require('../utils/logger');

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eventflow';
  const options = {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
    family: 4,
  };

  try {
    await mongoose.connect(mongoURI, options);
    logger.info('MongoDB Connected Successfully!');
    await seedAdminAccount();
  } catch (err) {
    logger.error('MongoDB Connection Error', err);
    if (process.env.NODE_ENV === 'production') {
      setTimeout(() => {
        logger.warn('Retrying MongoDB connection...');
        connectDB().catch(() => {});
      }, 5000).unref();
    }
  }
};

module.exports = connectDB;
