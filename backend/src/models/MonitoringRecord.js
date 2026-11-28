'use strict';

const mongoose = require('mongoose');

const monitoringRecordSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ['probe', 'glitch', 'config'],
      required: true,
      index: true,
    },
    // Probe fields
    trigger: { type: String },
    status: { type: String },
    statusCode: { type: Number },
    healthScore: { type: Number },
    latencyMs: { type: Number },
    summary: { type: String },
    subsystems: { type: Array, default: undefined },
    // Glitch fields
    method: { type: String },
    path: { type: String },
    severity: { type: String },
    durationMs: { type: Number },
    location: { type: String },
    message: { type: String },
    // Config fields
    intervalMinutes: { type: Number },
    // Auto-expire probe/glitch logs after 7 days (config has null expiresAt)
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

monitoringRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
monitoringRecordSchema.index({ kind: 1, createdAt: -1 });

module.exports = mongoose.model('MonitoringRecord', monitoringRecordSchema);
