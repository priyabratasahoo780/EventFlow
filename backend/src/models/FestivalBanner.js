  // Mongoose model for Admin-published festival greeting cards displayed to users during festival dates.
 
'use strict';

const mongoose = require('mongoose');

const festivalBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    imageUrl: { type: String, required: true, trim: true, maxlength: 1000 },
    greeting: { type: String, required: true, trim: true, maxlength: 500 },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

festivalBannerSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('FestivalBanner', festivalBannerSchema);
