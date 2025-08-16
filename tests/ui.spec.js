const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
let server;

test.beforeAll(async () => {
  server = spawn('node', ['server.js'], { env: { ...process.env, PORT: '3100' } });
  await new Promise((r) => setTimeout(r, 1000));
});

test.afterAll(() => {
  server.kill();
});

test('loads homepage', async ({ page }) => {
  await page.goto('http://localhost:3100/');
  await expect(page).toHaveTitle(/Document Creator/);
});

test('health endpoint', async ({ request }) => {
  const res = await request.get('http://localhost:3100/api/health');
  expect(res.status()).toBe(200);
});
