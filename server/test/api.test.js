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

  // Seeded workflow statuses; pick "In progress".
  const statuses = (await agent.get('/api/statuses')).body;
  const doing = statuses.find((s) => s.key === 'doing');

  const task = await agent
    .post(`/api/projects/${project.body.id}/tasks`)
    .send({ title: 'Design homepage', statusId: doing.id });
  expect(task.status).toBe(201);
  expect(task.body.status_id).toBe(doing.id);

  const subtask = await agent
    .post(`/api/tasks/${task.body.id}/subtasks`)
    .send({ title: 'Draft wireframe' });
  expect(subtask.status).toBe(201);
  // Subtasks share the task workflow: a new one defaults to the owner's first
  // status (not done) and its derived `done` mirrors that.
  const todo = statuses.find((s) => s.key === 'todo');
  expect(subtask.body.status_id).toBe(todo.id);
  expect(subtask.body.done).toBe(0);

  // Moving it to a "done" status flips the derived `done` flag.
  const doneStatus = statuses.find((s) => s.is_done);
  const updated = await agent
    .patch(`/api/tasks/${task.body.id}/subtasks/${subtask.body.id}`)
    .send({ statusId: doneStatus.id });
  expect(updated.body.status_id).toBe(doneStatus.id);
  expect(updated.body.done).toBe(1);

  const tasks = await agent.get(`/api/projects/${project.body.id}/tasks`);
  expect(tasks.body).toHaveLength(1);
});

test('subtask rejects a status id the project owner does not own', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'sub@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'Subs' });
  const task = await agent.post(`/api/projects/${project.body.id}/tasks`).send({ title: 'T' });
  const subtask = await agent.post(`/api/tasks/${task.body.id}/subtasks`).send({ title: 'S' });

  // A status id outside the owner's set is a 400 (not a DB-constraint error).
  const bad = await agent
    .patch(`/api/tasks/${task.body.id}/subtasks/${subtask.body.id}`)
    .send({ statusId: 999999 });
  expect(bad.status).toBe(400);
});

test('deleting a status reassigns subtasks using it (no orphans)', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'del@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'Del' });
  const task = await agent.post(`/api/projects/${project.body.id}/tasks`).send({ title: 'T' });
  const statuses = (await agent.get('/api/statuses')).body;
  const doing = statuses.find((s) => s.key === 'doing');

  const subtask = (
    await agent.post(`/api/tasks/${task.body.id}/subtasks`).send({ title: 'S', statusId: doing.id })
  ).body;
  expect(subtask.status_id).toBe(doing.id);

  const del = await agent.delete(`/api/statuses/${doing.id}`);
  expect(del.status).toBe(204);

  // The subtask is reassigned to a surviving status, not left dangling.
  const after = (await agent.get(`/api/tasks/${task.body.id}/subtasks`)).body[0];
  expect(after.status_id).toBeTruthy();
  expect(after.status_id).not.toBe(doing.id);
});

test('tasks can be reordered and new tasks append to the end', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'r@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'Ordering' });
  const pid = project.body.id;

  const a = (await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'A' })).body;
  const b = (await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'B' })).body;
  const c = (await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'C' })).body;

  // New tasks append: default listing is creation order.
  let list = await agent.get(`/api/projects/${pid}/tasks`);
  expect(list.body.map((t) => t.title)).toEqual(['A', 'B', 'C']);

  // Reorder C, A, B.
  const reordered = await agent
    .patch(`/api/projects/${pid}/tasks/reorder`)
    .send({ orderedIds: [c.id, a.id, b.id] });
  expect(reordered.status).toBe(200);
  expect(reordered.body.map((t) => t.title)).toEqual(['C', 'A', 'B']);

  // The new order persists on a fresh fetch.
  list = await agent.get(`/api/projects/${pid}/tasks`);
  expect(list.body.map((t) => t.title)).toEqual(['C', 'A', 'B']);

  // A subset is allowed (e.g. reordering one section's tasks).
  const subset = await agent
    .patch(`/api/projects/${pid}/tasks/reorder`)
    .send({ orderedIds: [b.id, a.id] });
  expect(subset.status).toBe(200);

  // A foreign id (not in this project) is rejected as a 400.
  const bad = await agent
    .patch(`/api/projects/${pid}/tasks/reorder`)
    .send({ orderedIds: [a.id, 999999] });
  expect(bad.status).toBe(400);
});

test('project list includes task_count and done_count rollups', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'roll@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'Rollup' });
  const pid = project.body.id;
  const done = (await agent.get('/api/statuses')).body.find((s) => s.is_done);
  await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'one', statusId: done.id });
  await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'two' });

  const list = await agent.get('/api/projects');
  expect(list.body[0]).toMatchObject({ task_count: 2, done_count: 1 });
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
