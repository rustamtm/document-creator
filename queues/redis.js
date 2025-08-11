const IORedis = require('ioredis');
const { logger } = require('../utils/logger');

const redisOptionsFromUrl = () => {
  if (process.env.REDIS_URL) {
    // Works with redis:// and rediss:// (TLS) URLs
    return { connectionString: process.env.REDIS_URL };
  }
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
  };
};

const base = redisOptionsFromUrl();

let client = null;
try {
  client = new IORedis({
    ...base,
    // REQUIRED for BullMQ blocking connections:
    maxRetriesPerRequest: null,
    // Recommended to avoid ready check delay in some environments:
    enableReadyCheck: false,
  });
  client.on('error', (err) => {
    logger.warn(`Redis connection error: ${err.message}`);
  });
} catch (err) {
  logger.warn(`Failed to initialize Redis client: ${err.message}`);
}

module.exports = client;
