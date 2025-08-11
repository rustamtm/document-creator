const { Queue, QueueEvents } = require('bullmq');
const { connection } = require('./index');

const prepQueue = new Queue('prep', { connection });
const prepEvents = new QueueEvents('prep', { connection });

module.exports = { prepQueue, prepEvents };
