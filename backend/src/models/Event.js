/**
 * Event.js
 * Mongoose schema and model definition for events and tasks.
 */
const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Map to local ID
  title: { type: String, required: true },
  description: { type: String },
  date: { type: String, required: true },
  time: { type: String, required: true },
  isAllDay: { type: Boolean, default: false },
  category: { type: String, default: 'Academic' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  priorityScore: { type: Number, default: 0 },
  estimatedDuration: { type: Number, default: 30 }, // in minutes
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'late_completed', 'overdue', 'cancelled', 'pending_exit'],
    default: 'pending',
  },
  completed: { type: Boolean, default: false },

  // Location & Geofencing (Arrive / Leave reminders)
  location: { type: String, default: '' },
  locationDetails: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String },
  },
  locationReminderEnabled: { type: Boolean, default: false },
  geofenceRadius: { type: Number, default: 500 },
  triggerType: { type: String, enum: ['arrive', 'leave'], default: 'arrive' },
  locationReminderTriggered: { type: Boolean, default: false },
  locationTimeGate: {
    startHour: { type: Number },
    endHour: { type: Number },
    days: [{ type: String }],
  },
  pendingExitGeofenceId: { type: String },
  isCritical: { type: Boolean, default: false },
  checklist: [
    {
      id: { type: String },
      text: { type: String },
      completed: { type: Boolean, default: false },
    },
  ],

  // Attachments & Contacts
  image: { type: String },
  video: { type: String },
  linkedContact: {
    name: { type: String },
    phone: { type: String },
    email: { type: String },
  },

  // Timestamps for status tracking
  startedAt: { type: Date },
  completedAt: { type: Date },

  // Ownership and Visibility
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: { type: String, enum: ['onlyMe', 'friends', 'selectedFriends'], default: 'onlyMe' },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For selectedFriends

  // Reminders & Alarm configurations
  reminders: [{ type: Object, default: [] }],
}, { timestamps: true });

// Optimize query performance for task lists
eventSchema.index({ ownerId: 1, status: 1 });
eventSchema.index({ ownerId: 1, date: 1 });
eventSchema.index({ ownerId: 1, date: 1, status: 1 });

module.exports = mongoose.model('Event', eventSchema);
