const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Map to local ID
  title: { type: String, required: true },
  description: { type: String },
  date: { type: String, required: true },
  time: { type: String, required: true },
  category: { type: String, default: 'Academic' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  priorityScore: { type: Number, default: 0 },
  estimatedDuration: { type: Number, default: 30 }, // in minutes
  status: { type: String, enum: ['pending', 'in_progress', 'completed', 'late_completed', 'overdue', 'cancelled'], default: 'pending' },
  completed: { type: Boolean, default: false },
  
  // Location
  location: { type: String, default: '' },
  locationDetails: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String }
  },

  // Attachments & Contacts
  image: { type: String },
  video: { type: String },
  linkedContact: {
    name: { type: String },
    phone: { type: String },
    email: { type: String }
  },

  // Timestamps for status tracking
  startedAt: { type: Date },
  completedAt: { type: Date },
  
  // Ownership and Visibility
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: { type: String, enum: ['onlyMe', 'friends', 'selectedFriends'], default: 'onlyMe' },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // For selectedFriends

  // Reminders & Alarm configurations
  reminders: [{ type: Object, default: [] }]
}, { timestamps: true });

// Optimize query performance for task lists
eventSchema.index({ ownerId: 1, status: 1 });
eventSchema.index({ ownerId: 1, date: 1 });
eventSchema.index({ ownerId: 1, date: 1, status: 1 });

module.exports = mongoose.model('Event', eventSchema);
