//  Handles verified media uploads (Cloudinary Cloud Storage + safe local fallback) and safe file cleanup.

'use strict';

const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Event = require('../models/Event');
const { isConfigured, uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

exports.uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid image file uploaded' });
  }

  try {
    if (isConfigured) {
      const cloudResult = await uploadToCloudinary(req.file.path, {
        folder: 'eventflow/images',
        resourceType: 'image',
      });

      if (cloudResult && cloudResult.url) {
        return res.json({
          message: 'Image uploaded successfully to Cloudinary',
          url: cloudResult.url,
          filename: cloudResult.publicId || req.file.filename,
          provider: 'cloudinary',
          bytes: cloudResult.bytes,
        });
      }
    }

    // Local storage fallback
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: 'Image uploaded successfully',
      url: fileUrl,
      filename: req.file.filename,
      provider: 'local',
    });
  } catch (err) {
    logger.error(`[Upload] Image upload error: ${err.message}`);
    // If Cloudinary failed, keep local file as fallback
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: 'Image saved locally (Cloud upload fallback)',
      url: fileUrl,
      filename: req.file.filename,
      provider: 'local',
    });
  }
};

exports.uploadVideo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid video file uploaded' });
  }

  try {
    if (isConfigured) {
      const cloudResult = await uploadToCloudinary(req.file.path, {
        folder: 'eventflow/videos',
        resourceType: 'video',
      });

      if (cloudResult && cloudResult.url) {
        return res.json({
          message: 'Video uploaded successfully to Cloudinary',
          url: cloudResult.url,
          filename: cloudResult.publicId || req.file.filename,
          provider: 'cloudinary',
          bytes: cloudResult.bytes,
          duration: cloudResult.duration,
        });
      }
    }

    // Local storage fallback
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: 'Video uploaded successfully',
      url: fileUrl,
      filename: req.file.filename,
      provider: 'local',
    });
  } catch (err) {
    logger.error(`[Upload] Video upload error: ${err.message}`);
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      message: 'Video saved locally (Cloud upload fallback)',
      url: fileUrl,
      filename: req.file.filename,
      provider: 'local',
    });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const rawTarget = String(req.query.target || req.body?.target || req.params.id || '').trim();
    if (!rawTarget) {
      return res.status(400).json({ error: 'Invalid filename or media identifier.' });
    }

    const userId = req.userId || (req.user && req.user._id);

    // If it's a Cloudinary publicId or URL
    if (rawTarget.includes('eventflow/') || rawTarget.startsWith('http://') || rawTarget.startsWith('https://')) {
      const isOwner = await Event.exists({
        ownerId: userId,
        $or: [
          { image: { $regex: new RegExp(rawTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) } },
          { video: { $regex: new RegExp(rawTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) } },
        ],
      });
      const userOwnsProfile = await User.exists({
        _id: userId,
        profilePhoto: { $regex: new RegExp(rawTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) },
      });

      if (!isOwner && !userOwnsProfile) {
        return res.status(403).json({ error: 'Unauthorized to delete this cloud asset.' });
      }

      await deleteFromCloudinary(rawTarget, 'image');
      await deleteFromCloudinary(rawTarget, 'video');
      return res.json({ message: 'Media removed from cloud successfully' });
    }

    // Local file cleanup
    const safeFilename = path.basename(rawTarget);
    if (!safeFilename || safeFilename !== rawTarget) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const expectedUrl = `/uploads/${safeFilename}`;
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
