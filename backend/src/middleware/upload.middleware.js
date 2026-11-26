  // Hardened file upload pipeline with extension/MIME allowlists, random filenames, and magic-byte malware checks.
 
'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
]);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt =
      IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext)
        ? ext
        : file.mimetype?.startsWith('video/')
          ? '.mp4'
          : '.jpg';
    cb(null, `${file.fieldname}-${crypto.randomUUID()}${safeExt}`);
  },
});

const createFileFilter = (allowedExts, allowedMimes, label) => (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (!allowedMimes.has(mime) || (ext && !allowedExts.has(ext))) {
    const err = new Error(`Unsupported ${label} format. Executable, script, and SVG files are blocked.`);
    err.code = 'INVALID_FILE_TYPE';
    return cb(err, false);
  }
  cb(null, true);
};

exports.uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per image
  fileFilter: createFileFilter(IMAGE_EXTENSIONS, IMAGE_MIMES, 'image'),
});

exports.uploadVideo = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per video
  fileFilter: createFileFilter(VIDEO_EXTENSIONS, VIDEO_MIMES, 'video'),
});


  // Inspect actual binary magic bytes of an uploaded file so disguised malware (e.g. virus.exe -> virus.jpg) is blocked.
 
function hasValidMagicBytes(filePath, kind) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buf, 0, 16, 0);
    if (bytesRead < 8) return false;

    if (kind === 'image') {
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isPng =
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a;
      const isWebp =
        buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buf.subarray(8, 12).toString('ascii') === 'WEBP';
      const isIsoBmff = buf.subarray(4, 8).toString('ascii') === 'ftyp'; // HEIC / HEIF

      return isJpeg || isPng || isWebp || isIsoBmff;
    }

    if (kind === 'video') {
      const boxType = buf.subarray(4, 8).toString('ascii');
      const isIsoVideo = ['ftyp', 'moov', 'mdat', 'free', 'wide'].includes(boxType);
      const isWebm = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
      return isIsoVideo || isWebm;
    }

    return false;
  } finally {
    fs.closeSync(fd);
  }
}

exports.verifyFileSignature = (kind) => (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    if (!hasValidMagicBytes(req.file.path, kind)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        error: 'File content does not match allowed media signature. Upload rejected.',
      });
    }
    return next();
  } catch (_err) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Unable to validate uploaded file.' });
  }
};
