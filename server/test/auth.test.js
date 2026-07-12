import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec('DELETE FROM users;');
});

test('register/login/me return the theme preference (default dark)', async () => {
  const agent = request.agent(app);

  const reg = await agent
    .post('/api/auth/register')
    .send({ email: 'theme@x.com', password: 'password123' });
  expect(reg.status).toBe(201);
  expect(reg.body.theme).toBe('dark');

  const me = await agent.get('/api/auth/me');
  expect(me.body.theme).toBe('dark');

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'theme@x.com', password: 'password123' });
  expect(login.body.theme).toBe('dark');
});

test('PATCH /api/auth/me persists a valid theme and it is returned by /me', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'p@x.com', password: 'password123' });

  const patch = await agent.patch('/api/auth/me').send({ theme: 'light' });
  expect(patch.status).toBe(200);
  expect(patch.body.theme).toBe('light');

  const me = await agent.get('/api/auth/me');
  expect(me.body.theme).toBe('light');
});

test('PATCH /api/auth/me rejects an invalid theme with 400', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'bad@x.com', password: 'password123' });

  const res = await agent.patch('/api/auth/me').send({ theme: 'neon' });
  expect(res.status).toBe(400);
});

test('PATCH /api/auth/me requires authentication', async () => {
  const res = await request(app).patch('/api/auth/me').send({ theme: 'light' });
  expect(res.status).toBe(401);
});
