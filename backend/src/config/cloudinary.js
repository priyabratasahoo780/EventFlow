'use strict';

const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const logger = require('../utils/logger');

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const apiKey = process.env.CLOUDINARY_API_KEY || '';
const apiSecret = process.env.CLOUDINARY_API_SECRET || '';
const cloudinaryUrl = process.env.CLOUDINARY_URL || '';

const isConfigured = Boolean((cloudName && apiKey && apiSecret) || cloudinaryUrl);

if (isConfigured) {
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  } else {
    cloudinary.config({ secure: true });
  }
  logger.info(`[Cloudinary] Configured successfully for cloud: ${cloudName || 'via CLOUDINARY_URL'}`);
} else {
  logger.warn('[Cloudinary] Missing credentials. File uploads will fallback to local disk storage.');
}

//  Automatically applies auto-format and auto-quality optimization for minimal storage & ultra-fast loading.
async function uploadToCloudinary(filePath, options = {}) {
  if (!isConfigured) {
    return null;
  }

  const {
    folder = 'eventflow',
    resourceType = 'auto',
    tags = ['eventflow'],
  } = options;

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: resourceType,
      quality: 'auto:good',
      fetch_format: 'auto',
      tags,
    });

    // Remove local temp file once safely uploaded to Cloudinary
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_unlinkErr) {
      // Non-blocking cleanup warning
    }

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      duration: result.duration,
    };
  } catch (error) {
    logger.error(`[Cloudinary] Upload failed: ${error.message}`);
    throw error;
  }
}

  // Extract publicId and delete asset from Cloudinary
async function deleteFromCloudinary(urlOrPublicId, resourceType = 'image') {
  if (!isConfigured || !urlOrPublicId) return false;

  try {
    let publicId = urlOrPublicId;
    if (urlOrPublicId.startsWith('http://') || urlOrPublicId.startsWith('https://')) {
      // Extract public_id from Cloudinary URL (e.g. eventflow/filename)
      const matches = urlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
      if (matches && matches[1]) {
        publicId = matches[1];
      }
    }

    const res = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return res.result === 'ok';
  } catch (err) {
    logger.warn(`[Cloudinary] Failed to delete asset ${urlOrPublicId}: ${err.message}`);
    return false;
  }
}

module.exports = {
  cloudinary,
  isConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
};
