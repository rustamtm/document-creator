const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/convert', upload.single('file'), (req, res) => {
  const file = req.file;
  const direction = req.body.direction;
  if (!file) {
    return res.status(400).send('No file uploaded');
  }
  const outputExt = direction === 'to-md' ? '.md' : '.docx';
  const outputPath = path.join('uploads', file.filename + outputExt);

  const args = ['docx_md_roundtrip.py', direction, file.path, '-o', outputPath];

  const py = spawn('python3', args);
  py.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).send('Conversion failed');
    }
    if (direction === 'to-md') {
      const text = fs.readFileSync(outputPath, 'utf8');
      res.json({ content: text });
    } else {
      res.download(outputPath, 'output.docx');
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
