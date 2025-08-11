const { Worker } = require('bullmq');
const connection = require('../queues/redis');
const { logger } = require('../utils/logger');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const worker = new Worker(
  'train',
  async (job) => {
    const { configPath, runName, requestId } = job.data;
    const python = process.env.COQUI_PY || 'python3';
    const outputPath = path.join('runs', runName);
    const args = [
      '-m',
      'TTS.bin.train',
      '--config_path',
      configPath,
      '--run_name',
      runName,
      '--output_path',
      outputPath,
    ];

    const logDir = path.join('logs', 'jobs');
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, `${job.id}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });

    return await new Promise((resolve, reject) => {
      const child = spawn(python, args, {
        env: { ...process.env, JOB_ID: job.id, REQUEST_ID: requestId || '' },
      });

      child.stdout.on('data', (d) => {
        const text = d.toString();
        logStream.write(text);
        try {
          const evt = JSON.parse(text);
          if (typeof evt.percent === 'number') {
            job.updateProgress(evt.percent);
          }
        } catch {
          // ignore non-JSON lines
        }
      });
      child.stderr.on('data', (d) => logStream.write(d.toString()));
      child.on('close', (code) => {
        logStream.end();
        if (code === 0) {
          resolve({ outputPath });
        } else {
          reject(new Error(`Training failed with code ${code}`));
        }
      });
    });
  },
  { connection }
);

worker.on('failed', (job, err) => {
  logger.error('Train job failed', { jobId: job.id, err: err.message });
});

module.exports = worker;
