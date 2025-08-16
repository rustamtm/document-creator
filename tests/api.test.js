const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../server');

test('health endpoint', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.ok(res.body.ok);
});
