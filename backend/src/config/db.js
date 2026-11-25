/**
 * db.js
 * MongoDB database connection setup using Mongoose.
 */
const mongoose = require('mongoose');
const { seedAdminAccount } = require('./seedAdmin');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eventflow';
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
    console.log('MongoDB Connected Successfully!');
    await seedAdminAccount();
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
  }
};

module.exports = connectDB;
