import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  // Delete tasks before statuses (tasks.status_id references statuses).
  db.exec(
    'DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM sections; DELETE FROM statuses; DELETE FROM projects; DELETE FROM users;',
  );
});

async function freshAgent(email = 'st@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

test('a user gets three default statuses on first access', async () => {
  const agent = await freshAgent();
  const statuses = (await agent.get('/api/statuses')).body;
  expect(statuses.map((s) => s.name)).toEqual(['To do', 'In progress', 'Done']);
  expect(statuses.find((s) => s.name === 'Done').is_done).toBe(1);
  expect(statuses.filter((s) => s.is_done)).toHaveLength(1);
});

test('create, rename/recolor, and reorder statuses', async () => {
  const agent = await freshAgent();
  const created = await agent.post('/api/statuses').send({ name: 'In review', color: 'blue' });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ name: 'In review', color: 'blue', is_done: 0 });

  const updated = await agent
    .patch(`/api/statuses/${created.body.id}`)
    .send({ name: 'Review', color: 'violet', isDone: true });
  expect(updated.body).toMatchObject({ name: 'Review', color: 'violet', is_done: 1 });

  const list = (await agent.get('/api/statuses')).body;
  const reversed = list.map((s) => s.id).reverse();
  const reordered = await agent.patch('/api/statuses/reorder').send({ orderedIds: reversed });
  expect(reordered.body.map((s) => s.id)).toEqual(reversed);
});

test('deleting a status reassigns its tasks and refuses the last one', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  const statuses = (await agent.get('/api/statuses')).body;
  const doing = statuses.find((s) => s.key === 'doing');

  const task = await agent
    .post(`/api/projects/${project.id}/tasks`)
    .send({ title: 'T', statusId: doing.id });
  expect(task.body.status_id).toBe(doing.id);

  // Delete "In progress" → the task is reassigned (not orphaned).
  expect((await agent.delete(`/api/statuses/${doing.id}`)).status).toBe(204);
  const after = await agent.get(`/api/projects/${project.id}/tasks`);
  const remaining = (await agent.get('/api/statuses')).body.map((s) => s.id);
  expect(remaining).not.toContain(doing.id);
  expect(remaining).toContain(after.body[0].status_id);

  // Delete down to the last one → refused.
  for (const s of (await agent.get('/api/statuses')).body.slice(1)) {
    await agent.delete(`/api/statuses/${s.id}`);
  }
  const last = (await agent.get('/api/statuses')).body;
  expect(last).toHaveLength(1);
  const refused = await agent.delete(`/api/statuses/${last[0].id}`);
  expect(refused.status).toBe(400);
});

test('a new task defaults to the first status; done status drives the rollup', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  const statuses = (await agent.get('/api/statuses')).body;

  const task = (await agent.post(`/api/projects/${project.id}/tasks`).send({ title: 'T' })).body;
  expect(task.status_id).toBe(statuses[0].id); // first = "To do"

  const done = statuses.find((s) => s.is_done);
  await agent.patch(`/api/projects/${project.id}/tasks/${task.id}`).send({ statusId: done.id });
  const list = await agent.get('/api/projects');
  expect(list.body[0]).toMatchObject({ task_count: 1, done_count: 1 });
});

test('statuses are per-user', async () => {
  const alice = await freshAgent('a@x.com');
  const created = (await alice.post('/api/statuses').send({ name: 'Blocked', color: 'red' })).body;
  const bob = await freshAgent('b@x.com');
  expect((await bob.get('/api/statuses')).body.map((s) => s.name)).not.toContain('Blocked');
  expect((await bob.patch(`/api/statuses/${created.id}`).send({ name: 'x' })).status).toBe(404);
});
