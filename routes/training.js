const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const rateLimit = require('express-rate-limit');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const { getPython } = require('../utils/python');

const router = express.Router();

const upload = multer({ dest: 'uploads/tmp' });
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });
const streamLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

const jobs = {};

function tailFile(file, maxChars = 2000) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return data.slice(-maxChars);
  } catch (err) {
    return '';
  }
}

function parseMetrics(logData) {
  const stepMatch = logData.match(/Step:\s*(\d+)/);
  const trainLossMatch = logData.match(/Train Loss:\s*([0-9.]+)/);
  const valLossMatch = logData.match(/Val Loss:\s*([0-9.]+)/);
  return {
    steps: stepMatch ? Number(stepMatch[1]) : undefined,
    loss: {
      train: trainLossMatch ? Number(trainLossMatch[1]) : undefined,
      val: valLossMatch ? Number(valLossMatch[1]) : undefined,
    },
  };
}

router.post(
  '/data/upload',
  uploadLimiter,
  upload.fields([
    { name: 'audio[]', maxCount: 1000 },
    { name: 'transcripts', maxCount: 1 },
  ]),
  (req, res) => {
    fs.mkdirSync('uploads/raw_audio', { recursive: true });
    const audioFiles = req.files['audio[]'] || [];
    let count = 0;
    for (const file of audioFiles) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext === '.zip') {
        const zip = new AdmZip(file.path);
        const entries = zip.getEntries();
        for (const entry of entries) {
          if (entry.isDirectory) continue;
          if (entry.entryName.endsWith('.zip')) {
            return res.status(400).json({ ok: false, error: 'Nested ZIP not allowed' });
          }
          zip.extractEntryTo(entry, 'uploads/raw_audio', false, true);
          count++;
        }
        fs.unlinkSync(file.path);
      } else {
        const dest = path.join('uploads/raw_audio', file.originalname);
        fs.renameSync(file.path, dest);
        count++;
      }
    }
    const transcript = (req.files['transcripts'] || [])[0];
    if (transcript) {
      fs.renameSync(transcript.path, path.join('uploads', 'transcripts.tsv'));
    }
    res.json({ ok: true, count });
  }
);

router.post('/data/prep', async (req, res) => {
  const {
    inputDir,
    transcriptFile,
    outputDir,
    speaker,
    language,
    sampleRate,
    maxLen,
    vad,
  } = req.body;
  const python = getPython('TRAIN_PY');
  const args = [
    'scripts/prep_xtts_data.py',
    '--input-dir',
    inputDir,
    '--transcript-file',
    transcriptFile,
    '--output-dir',
    outputDir,
    '--speaker',
    speaker,
    '--language',
    language,
    '--max-len',
    String(maxLen),
  ];
  if (vad) args.push('--vad');
  const child = spawn(python, args);
  let out = '';
  child.stdout.on('data', (d) => (out += d.toString()));
  child.stderr.on('data', (d) => (out += d.toString()));
  child.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({ ok: false, error: out });
    }
    let clips = 0;
    try {
      const meta = fs.readFileSync(path.join(outputDir, 'metadata.csv'), 'utf8');
      clips = meta.trim().split(/\r?\n/).length;
    } catch (err) {
      // ignore
    }
    res.json({ ok: true, clips, dataset: path.join(outputDir, 'metadata.csv') });
  });
});

router.post('/train/start', (req, res) => {
  const { configPath, runName } = req.body;
  const python = getPython('TRAIN_PY');
  const jobId = crypto.randomUUID();
  const logPath = path.join('logs', `train-${jobId}.log`);
  const logStream = fs.createWriteStream(logPath);
  const args = [
    '-m',
    'TTS.bin.train',
    '--config_path',
    configPath,
    '--run_name',
    runName,
    '--output_path',
    path.join('runs', runName),
  ];
  const child = spawn(python, args);
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  jobs[jobId] = {
    pid: child.pid,
    status: 'running',
    logPath,
    startedAt: Date.now(),
  };
  child.on('close', (code) => {
    jobs[jobId].status = code === 0 ? 'completed' : 'failed';
  });
  res.json({ ok: true, jobId });
});

router.get('/train/status', (req, res) => {
  const { jobId } = req.query;
  const job = jobs[jobId];
  if (!job) return res.status(404).json({ ok: false, error: 'Job not found' });
  const logTail = tailFile(job.logPath);
  const metrics = parseMetrics(logTail);
  res.json({ ok: true, jobId, status: job.status, ...metrics, logTail });
});

router.get('/train/stream/:jobId', streamLimiter, (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];
  if (!job) {
    return res.status(404).end();
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  let lastSize = 0;
  const sendUpdates = () => {
    fs.stat(job.logPath, (err, stats) => {
      if (err) return;
      if (stats.size > lastSize) {
        const stream = fs.createReadStream(job.logPath, {
          start: lastSize,
          end: stats.size,
        });
        let chunk = '';
        stream.on('data', (d) => (chunk += d.toString()));
        stream.on('end', () => {
          res.write(`data: ${chunk.replace(/\n/g, '\\n')}\n\n`);
          lastSize = stats.size;
        });
      }
    });
  };
  const interval = setInterval(sendUpdates, 1000);
  req.on('close', () => {
    clearInterval(interval);
  });
});

router.get('/artifacts', (req, res) => {
  const base = 'runs';
  const items = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const stat = fs.statSync(full);
        items.push({
          path: full,
          bytes: stat.size,
          mtime: stat.mtime.toISOString(),
        });
      }
    }
  };
  if (fs.existsSync(base)) walk(base);
  res.json({ ok: true, items });
});

router.get('/system/gpu', (req, res) => {
  const python = getPython('TRAIN_PY');
  const code =
    "import torch, json; print(json.dumps({'cuda': torch.cuda.is_available(), 'cuda_version': getattr(torch.version, 'cuda', None), 'torch_version': torch.__version__}))";
  const child = spawn(python, ['-c', code]);
  let out = '';
  child.stdout.on('data', (d) => (out += d.toString()));
  child.on('close', () => {
    try {
      const info = JSON.parse(out.trim());
      res.json({ ok: true, info });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Failed to query GPU' });
    }
  });
});

module.exports = router;
