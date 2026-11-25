/**
 * User.js
 * Mongoose schema and model definition for user profiles.
 */
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
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isBanned: { type: Boolean, default: false },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Two-Factor Authentication (2FA) fields
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOtp: { type: String, default: null },         // hashed OTP
  twoFactorOtpExpiry: { type: Date, default: null },     // 10-min TTL
  twoFactorOtpAttempts: { type: Number, default: 0 },    // failed verification attempts
  twoFactorLastSentAt: { type: Date, default: null },    // resend cooldown timestamp
  // Password Reset OTP fields
  resetPasswordOtp: { type: String, default: null },
  resetPasswordOtpExpiry: { type: Date, default: null },
  resetPasswordOtpAttempts: { type: Number, default: 0 },
  resetPasswordLastSentAt: { type: Date, default: null },
  // Daily Password Change Rate Limiting (Strictly max 2 times per 24-hour day)
  passwordChangeHistory: [{ type: Date }],
  // Periodic 3-month auto-archive timestamp for tasks older than 1.5 months
  lastTaskCleanupAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ isBanned: 1 });

module.exports = mongoose.model('User', userSchema);
