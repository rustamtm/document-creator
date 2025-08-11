const { Worker } = require('bullmq');
const connection = require('../queues/redis');
const { logger } = require('../utils/logger');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

if (!connection) {
  logger.warn('Redis connection not available, prep worker disabled');
  module.exports = null;
  return;
}

const worker = new Worker(
  'prep',
  async (job) => {
    const { inputDir, transcriptFile, outputDir, speaker, language, sampleRate, maxLen, vad, requestId } = job.data;
    const python = process.env.COQUI_PY || 'python3';
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
      '--sample-rate',
      String(sampleRate),
      '--max-len',
      String(maxLen || 15),
    ];
    if (vad) args.push('--vad');

    const logDir = path.join('logs', 'jobs');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `${job.id}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    return await new Promise((resolve, reject) => {
      const child = spawn(python, args, {
        env: { ...process.env, JOB_ID: job.id, REQUEST_ID: requestId || '' },
      });
      child.stdout.on('data', (d) => logStream.write(d.toString()));
      child.stderr.on('data', (d) => logStream.write(d.toString()));
      child.on('close', (code) => {
        logStream.end();
        if (code === 0) {
          resolve({ outputDir });
        } else {
          reject(new Error(`Prep failed with code ${code}`));
        }
      });
    });
  },
  { connection }
);

module.exports = worker;
