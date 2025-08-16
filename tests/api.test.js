const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
process.env.ENABLE_REDIS = 'false';
require.cache[require.resolve('../queues/redis')] = { exports: null };
const app = require('../server');
const client = require('prom-client');

test('health endpoint', async () => {
  const req = request(app).get('/api/health');
  if (process.env.API_KEY) req.set('X-API-Key', process.env.API_KEY);
  const res = await req;
  assert.equal(res.status, 200);
  assert.ok(res.body.ok);
});

test.after(() => {
  client.register.clear();
});
