const { Queue, QueueScheduler, QueueEvents } = require('bullmq');
const { connection } = require('./index');

const prepQueue = new Queue('prep', { connection });
new QueueScheduler('prep', { connection });
const prepEvents = new QueueEvents('prep', { connection });

module.exports = { prepQueue, prepEvents };
