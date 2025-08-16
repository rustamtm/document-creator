require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const client = require('prom-client');
const { logger, requestIdMiddleware, httpLogger } = require('./utils/logger');
const redis = require('./queues/redis');
const { validateEnv } = require('./utils/env');
const { getPython } = require('./utils/python');
const cache = require('./utils/cache');

validateEnv();
const app = express();
app.use(requestIdMiddleware);
app.use(httpLogger);
app.use(helmet());
app.use(express.json());
app.use(cors());
const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use('/api', limiter);

client.collectDefaultMetrics();
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'code'],
});
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, code: res.statusCode });
  });
  next();
});

const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));
app.use('/media', express.static('media'));
app.use('/runs', express.static('runs'));

const apiKey = process.env.API_KEY;
const apiKeyMiddleware = (req, res, next) => {
  if (!apiKey) return next();
  if (req.get('X-API-Key') !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

app.use('/api', apiKeyMiddleware);

app.post('/convert', upload.single('file'), (req, res) => {
  const file = req.file;
  const direction = req.body.direction;
  if (!file) {
    return res.status(400).send('No file uploaded');
  }
  const outputExt = direction === 'to-md' ? '.md' : '.docx';
  const buffer = fs.readFileSync(file.path);
  if (process.env.ENABLE_CONVERT_CACHE === 'true') {
    const cached = cache.get(buffer, outputExt);
    if (cached) {
      if (direction === 'to-md') {
        return res.json({ content: cached.toString('utf8') });
      }
      const tmp = path.join('uploads', file.filename + outputExt);
      fs.writeFileSync(tmp, cached);
      return res.download(tmp, 'output.docx');
    }
  }
  const outputPath = path.join('uploads', file.filename + outputExt);
  const args = ['docx_md_roundtrip.py', direction, file.path, '-o', outputPath];
  const py = spawn(getPython('COQUI_PY'), args);
  py.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).send('Conversion failed');
    }
    const data = fs.readFileSync(outputPath);
    if (process.env.ENABLE_CONVERT_CACHE === 'true') {
      cache.set(buffer, outputExt, data);
    }
    if (direction === 'to-md') {
      res.json({ content: data.toString('utf8') });
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
  const python = getPython('COQUI_PY');
  const args = ['scripts/run_xtts.py', '--text', text, '--out', outputFile, '--model-path', modelPath, '--config-path', configPath];
  if (process.env.TTS_DEESSER === '1' || process.env.TTS_DEESSER === 'true') {
    args.push('--deesser');
  }
  if (process.env.TTS_LUFS) {
    args.push('--lufs', process.env.TTS_LUFS);
  }
  const py = spawn(python, args);
  py.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).send('TTS failed');
    }
    res.json({ audio: outputFile });
  });
});

const training = require('./routes/training');
app.use('/api', training);

const loadQueueFeatures = () => {
  require('./workers/train');
  require('./workers/prep');
  const jobs = require('./routes/jobs');
  app.use('/api/jobs', jobs);
};

if (process.env.ENABLE_REDIS === 'true') {
  loadQueueFeatures();
} else if (redis) {
  redis
    .ping()
    .then(loadQueueFeatures)
    .catch((err) => {
      logger.warn(`Redis not available, queue features disabled: ${err.message}`);
    });
} else {
  logger.warn('Redis not available, queue features disabled');
}

app.get('/api/health', (req, res) => {
  let python = '';
  try {
    const out = require('child_process').spawnSync(
      getPython('COQUI_PY'),
      ['-c', "import sys,json; print(json.dumps({'python': sys.version.split()[0]}))"]
    );
    python = JSON.parse(out.stdout.toString()).python;
  } catch (e) {
    python = 'unknown';
  }
  res.json({ ok: true, versions: { node: process.version, python } });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

module.exports = app;
