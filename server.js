const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use('/media', express.static('media'));

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

app.post('/api/tts', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).send('Text is required');
  }
  const modelPath = process.env.XTTS_MODEL_PATH;
  const configPath = process.env.XTTS_CONFIG_PATH;
  if (!modelPath || !configPath) {
    return res.status(500).send('Model paths not configured');
  }
  const outputFile = path.join('media', `tts_${Date.now()}.wav`);
  const python = process.env.COQUI_PY || 'python3';
  const args = ['scripts/run_xtts.py', '--text', text, '--out', outputFile, '--model-path', modelPath, '--config-path', configPath];
  const py = spawn(python, args);
  py.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).send('TTS failed');
    }
    res.json({ audio: outputFile });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
