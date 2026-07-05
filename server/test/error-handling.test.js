import { beforeEach, expect, test, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const app = createApp();

beforeEach(() => {
  db.exec('DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users;');
});

test('malformed JSON returns a clean 400', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Content-Type', 'application/json')
    .send('{ this is not valid json');
  expect(res.status).toBe(400);
  expect(res.body.error).toBe('Invalid JSON body');
});

test('unknown API route returns 404 JSON', async () => {
  const res = await request(app).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body.error).toBe('Not found');
});

test('a SQLite constraint violation becomes a clean 409 (no crash)', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'c@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'P' });

  // `status` has a CHECK constraint (todo|doing|done). An invalid value must not
  // crash the server — the error handler should turn it into a 409.
  const res = await agent
    .post(`/api/projects/${project.body.id}/tasks`)
    .send({ title: 'X', status: 'bogus' });
  expect(res.status).toBe(409);
});

test('unexpected errors return a generic 500 and are logged, not leaked', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const captured = {};
  const res = {
    status(code) {
      captured.status = code;
      return this;
    },
    json(body) {
      captured.body = body;
      return this;
    },
  };

  errorHandler(new Error('secret internal detail'), {}, res, () => {});

  expect(captured.status).toBe(500);
  expect(captured.body.error).toBe('Internal server error');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});
