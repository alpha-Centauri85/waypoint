import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(
    'DELETE FROM task_labels; DELETE FROM labels; DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users;',
  );
});

async function setup() {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'l@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'P' });
  return { agent, projectId: project.body.id };
}

test('labels: create, list, and reject a duplicate name', async () => {
  const { agent } = await setup();
  const created = await agent.post('/api/labels').send({ name: 'Legal', color: 'amber' });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ name: 'Legal', color: 'amber' });

  const list = await agent.get('/api/labels');
  expect(list.body).toHaveLength(1);

  // UNIQUE(user_id, name) → duplicate becomes a clean 409.
  const dup = await agent.post('/api/labels').send({ name: 'Legal' });
  expect(dup.status).toBe(409);
});

test('an invalid label colour is rejected with a 400', async () => {
  const { agent } = await setup();
  const res = await agent.post('/api/labels').send({ name: 'X', color: 'chartreuse' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/color/i);
});

test('labels attach to a task and come back embedded', async () => {
  const { agent, projectId } = await setup();
  const a = (await agent.post('/api/labels').send({ name: 'design' })).body;
  const b = (await agent.post('/api/labels').send({ name: 'urgent', color: 'red' })).body;

  // Attach at creation.
  const task = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: 'T', labelIds: [a.id, b.id] });
  expect(task.body.labels.map((l) => l.name)).toEqual(['design', 'urgent']);

  // Listing embeds labels too.
  const list = await agent.get(`/api/projects/${projectId}/tasks`);
  expect(list.body[0].labels).toHaveLength(2);

  // Replace with just one.
  const updated = await agent
    .patch(`/api/projects/${projectId}/tasks/${task.body.id}`)
    .send({ labelIds: [a.id] });
  expect(updated.body.labels.map((l) => l.name)).toEqual(['design']);
});

test("a task cannot be tagged with another user's label", async () => {
  const { agent, projectId } = await setup();

  const mallory = request.agent(app);
  await mallory.post('/api/auth/register').send({ email: 'm@x.com', password: 'password123' });
  const theirs = (await mallory.post('/api/labels').send({ name: 'secret' })).body;

  // Attaching a foreign label id is silently ignored (not attached), not an error.
  const task = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: 'T', labelIds: [theirs.id] });
  expect(task.body.labels).toEqual([]);
});

test('deleting a label removes it from its tasks', async () => {
  const { agent, projectId } = await setup();
  const label = (await agent.post('/api/labels').send({ name: 'temp' })).body;
  const task = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: 'T', labelIds: [label.id] });
  expect(task.body.labels).toHaveLength(1);

  await agent.delete(`/api/labels/${label.id}`);
  const list = await agent.get(`/api/projects/${projectId}/tasks`);
  expect(list.body[0].labels).toEqual([]);
});
