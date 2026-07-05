import { expect, test } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { makeRateLimiter } from '../src/middleware/rateLimit.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

test('helmet security headers are applied and X-Powered-By is removed', async () => {
  const res = await request(createApp()).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers).not.toHaveProperty('x-powered-by');
});

test('the rate limiter returns a clean 429 once the limit is exceeded', async () => {
  // Build a throwaway app with a low limit (the real authLimiter is skipped
  // under test). This exercises our handler → central errorHandler wiring.
  const app = express();
  const limiter = makeRateLimiter({
    windowMs: 60_000,
    max: 2,
    message: 'slow down',
    skip: () => false,
  });
  app.post('/try', limiter, (req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const agent = request(app);
  expect((await agent.post('/try')).status).toBe(200);
  expect((await agent.post('/try')).status).toBe(200);

  const blocked = await agent.post('/try');
  expect(blocked.status).toBe(429);
  expect(blocked.body.error).toBe('slow down');
});
