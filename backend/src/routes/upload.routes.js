/**
 * upload.routes.js
 * Protected upload endpoints with strict MIME filtering and binary signature checks.
 */
'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { uploadImage, uploadVideo, verifyFileSignature } = require('../middleware/upload.middleware');
const uploadController = require('../controllers/upload.controller');

router.use(authMiddleware);

router.post('/image', uploadImage.single('image'), verifyFileSignature('image'), uploadController.uploadImage);
router.post('/video', uploadVideo.single('video'), verifyFileSignature('video'), uploadController.uploadVideo);
router.delete('/:id', uploadController.deleteFile);

module.exports = router;
