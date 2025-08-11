const { Queue, QueueEvents } = require('bullmq');
const connection = require('./redis');

const trainQueue = new Queue('train', { connection });
const trainEvents = new QueueEvents('train', { connection });

module.exports = { trainQueue, trainEvents };
