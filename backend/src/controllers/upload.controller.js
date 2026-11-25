/**
 * upload.controller.js
 * Handles verified media uploads and safe file cleanup.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Event = require('../models/Event');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

exports.uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid image file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    message: 'Image uploaded successfully',
    url: fileUrl,
    filename: req.file.filename,
  });
};

exports.uploadVideo = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid video file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    message: 'Video uploaded successfully',
    url: fileUrl,
    filename: req.file.filename,
  });
};

exports.deleteFile = async (req, res) => {
  try {
    const safeFilename = path.basename(String(req.params.id || '').trim());
    if (!safeFilename || safeFilename !== req.params.id) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const expectedUrl = `/uploads/${safeFilename}`;
    const userId = req.userId || (req.user && req.user._id);

    // Ensure caller owns the media via their profile or an owned task before deleting from disk
    const userOwnsProfile = await User.exists({
      _id: userId,
      profilePhoto: { $regex: new RegExp(`${safeFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) },
    });
    const userOwnsTaskMedia = await Event.exists({
      ownerId: userId,
      $or: [{ image: expectedUrl }, { video: expectedUrl }],
    });

    if (!userOwnsProfile && !userOwnsTaskMedia) {
      return res.status(403).json({ error: 'Unauthorized to delete this file.' });
    }

    const targetPath = path.join(UPLOAD_DIR, safeFilename);
    fs.unlink(targetPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        return res.status(500).json({ error: 'Failed to remove file.' });
      }
      return res.json({ message: 'File deleted successfully', id: safeFilename });
    });
  } catch (_err) {
    res.status(500).json({ error: 'Failed to process delete request.' });
  }
};
