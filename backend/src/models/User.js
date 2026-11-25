const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uniqueId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  city: { type: String, default: '' },
  profilePhoto: { type: String, default: '' },
  expoPushToken: { type: String, default: '' },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Two-Factor Authentication (2FA) fields
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOtp: { type: String, default: null },         // hashed OTP
  twoFactorOtpExpiry: { type: Date, default: null },     // 10-min TTL
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
