import { expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

test('GET /api/health returns ok', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('unknown API route returns 404', async () => {
  const res = await request(app).get('/api/does-not-exist');
  expect(res.status).toBe(404);
});
