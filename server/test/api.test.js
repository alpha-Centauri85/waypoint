import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  // Clean slate between tests (cascades handle children, but be explicit).
  db.exec('DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users;');
});

test('health check is public', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});

test('protected routes reject anonymous requests', async () => {
  const res = await request(app).get('/api/projects');
  expect(res.status).toBe(401);
});

test('full flow: register → project → task → subtask', async () => {
  const agent = request.agent(app); // persists the session cookie

  const reg = await agent
    .post('/api/auth/register')
    .send({ email: 'lee@example.com', password: 'password123' });
  expect(reg.status).toBe(201);
  expect(reg.body.email).toBe('lee@example.com');

  const project = await agent.post('/api/projects').send({ name: 'Launch site' });
  expect(project.status).toBe(201);

  const task = await agent
    .post(`/api/projects/${project.body.id}/tasks`)
    .send({ title: 'Design homepage', status: 'doing' });
  expect(task.status).toBe(201);
  expect(task.body.status).toBe('doing');

  const subtask = await agent
    .post(`/api/tasks/${task.body.id}/subtasks`)
    .send({ title: 'Draft wireframe' });
  expect(subtask.status).toBe(201);

  const done = await agent
    .patch(`/api/tasks/${task.body.id}/subtasks/${subtask.body.id}`)
    .send({ done: true });
  expect(done.body.done).toBe(1);

  const tasks = await agent.get(`/api/projects/${project.body.id}/tasks`);
  expect(tasks.body).toHaveLength(1);
});

test('users cannot see each other’s projects', async () => {
  const alice = request.agent(app);
  await alice.post('/api/auth/register').send({ email: 'alice@x.com', password: 'password123' });
  const proj = await alice.post('/api/projects').send({ name: 'Alice secret' });

  const bob = request.agent(app);
  await bob.post('/api/auth/register').send({ email: 'bob@x.com', password: 'password123' });

  expect((await bob.get('/api/projects')).body).toHaveLength(0);
  expect((await bob.get(`/api/projects/${proj.body.id}`)).status).toBe(404);
});
