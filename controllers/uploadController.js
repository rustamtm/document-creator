const uploadAudio = (req, res) => {
  const file = req.file || (req.files && req.files[0]);
  res.json({ ok: true, file: file ? file.originalname || file.filename : null });
};

const handleUpload = (req, res) => {
  res.json({ ok: true });
};

module.exports = { uploadAudio, handleUpload };
