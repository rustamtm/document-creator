const express = require('express');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');
const { trainQueue, trainEvents } = require('../queues/train.queue');
const { prepQueue, prepEvents } = require('../queues/prep.queue');

const router = express.Router();

router.post('/train', async (req, res, next) => {
  try {
    const schema = z.object({
      configPath: z.string(),
      runName: z.string().optional(),
      modelName: z.string().optional(),
      datasetPath: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const job = await trainQueue.add(
      'train',
      { ...body, requestId: req.requestId },
      { removeOnComplete: 50, removeOnFail: 100 }
    );
    res.json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
});

router.post('/prep', async (req, res, next) => {
  try {
    const schema = z.object({
      inputDir: z.string(),
      transcriptFile: z.string(),
      outputDir: z.string(),
      speaker: z.string(),
      language: z.string(),
      sampleRate: z.number().optional(),
      maxLen: z.number().optional(),
      vad: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    const job = await prepQueue.add(
      'prep',
      { ...body, requestId: req.requestId },
      { removeOnComplete: 50, removeOnFail: 100 }
    );
    res.json({ jobId: job.id });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/progress', async (req, res) => {
  const { id } = req.params;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  const send = (data) => {
    res.write(`event: progress\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  const onProgress = ({ jobId, data }) => {
    if (jobId === id) {
      send({ ts: Date.now(), jobId, ...data });
    }
  };
  const onCompleted = ({ jobId, returnvalue }) => {
    if (jobId === id) {
      send({ ts: Date.now(), jobId, completed: true, returnvalue });
    }
  };
  const onFailed = ({ jobId, failedReason }) => {
    if (jobId === id) {
      send({ ts: Date.now(), jobId, failed: true, failedReason });
    }
  };
  trainEvents.on('progress', onProgress);
  prepEvents.on('progress', onProgress);
  trainEvents.on('completed', onCompleted);
  prepEvents.on('completed', onCompleted);
  trainEvents.on('failed', onFailed);
  prepEvents.on('failed', onFailed);
  req.on('close', () => {
    trainEvents.off('progress', onProgress);
    prepEvents.off('progress', onProgress);
    trainEvents.off('completed', onCompleted);
    prepEvents.off('completed', onCompleted);
    trainEvents.off('failed', onFailed);
    prepEvents.off('failed', onFailed);
  });
});

router.get('/:id/logs', (req, res) => {
  const { id } = req.params;
  const lines = Number(req.query.lines || 200);
  const logFile = path.join('logs', 'jobs', `${id}.log`);
  if (!fs.existsSync(logFile)) {
    return res.status(404).send('Log not found');
  }
  const data = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
  res.type('text/plain').send(data.slice(-lines).join('\n'));
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const job = (await trainQueue.getJob(id)) || (await prepQueue.getJob(id));
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const state = await job.getState();
  res.json({
    id: job.id,
    name: job.name,
    state,
    progress: job.progress,
    attemptsMade: job.attemptsMade,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  });
});

module.exports = router;
