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

test('a SQLite constraint violation becomes a clean 409 (no crash)', () => {
  // Validation now rejects bad input before it can reach the DB, so we exercise
  // the constraint branch directly: any error whose code starts with
  // SQLITE_CONSTRAINT must be turned into a 409 rather than a 500.
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
  const err = Object.assign(new Error('UNIQUE constraint failed'), {
    code: 'SQLITE_CONSTRAINT_UNIQUE',
  });

  errorHandler(err, {}, res, () => {});

  expect(captured.status).toBe(409);
  expect(captured.body.error).toBe('Request violates a data constraint');
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
