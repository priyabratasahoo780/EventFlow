const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');
const uploadController = require('../controllers/upload.controller');

router.use(authMiddleware);

router.post('/image', upload.single('image'), uploadController.uploadImage);
router.post('/video', upload.single('video'), uploadController.uploadVideo);
router.delete('/:id', uploadController.deleteFile);

module.exports = router;
