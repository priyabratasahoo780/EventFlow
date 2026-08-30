exports.uploadImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    message: 'Image uploaded successfully',
    url: fileUrl,
    filename: req.file.filename
  });
};

exports.uploadVideo = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    message: 'Video uploaded successfully',
    url: fileUrl,
    filename: req.file.filename
  });
};

exports.deleteFile = (req, res) => {
  res.json({ message: 'File deleted successfully', id: req.params.id });
};
