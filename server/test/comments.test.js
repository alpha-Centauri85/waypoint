import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(`
    DELETE FROM comments; DELETE FROM activities;
    DELETE FROM subtasks; DELETE FROM task_labels; DELETE FROM tasks; DELETE FROM sections;
    DELETE FROM project_labels; DELETE FROM projects; DELETE FROM statuses; DELETE FROM users;
  `);
});

async function freshAgent(email = 't@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

async function taskFor(agent) {
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  return (await agent.post(`/api/projects/${project.id}/tasks`).send({ title: 'T' })).body;
}

test('comments: create, list, edit (stamps updated_at), delete', async () => {
  const agent = await freshAgent();
  const task = await taskFor(agent);

  const created = await agent.post(`/api/tasks/${task.id}/comments`).send({ body: 'first' });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ body: 'first', author_email: 't@x.com', updated_at: null });

  await agent.post(`/api/tasks/${task.id}/comments`).send({ body: 'second' });
  const list = (await agent.get(`/api/tasks/${task.id}/comments`)).body;
  expect(list.map((c) => c.body)).toEqual(['first', 'second']); // oldest-first

  const edited = await agent
    .patch(`/api/tasks/${task.id}/comments/${created.body.id}`)
    .send({ body: 'edited' });
  expect(edited.body.body).toBe('edited');
  expect(edited.body.updated_at).not.toBeNull();

  expect((await agent.delete(`/api/tasks/${task.id}/comments/${created.body.id}`)).status).toBe(
    204,
  );
  expect((await agent.get(`/api/tasks/${task.id}/comments`)).body.map((c) => c.body)).toEqual([
    'second',
  ]);
});

test('adding a comment logs an activity entry', async () => {
  const agent = await freshAgent();
  const task = await taskFor(agent);
  await agent.post(`/api/tasks/${task.id}/comments`).send({ body: 'hi' });

  const feed = (await agent.get(`/api/activities?taskId=${task.id}`)).body;
  expect(feed.some((a) => a.action === 'comment.added' && a.summary === 'Commented on “T”')).toBe(
    true,
  );
});

test("comments are scoped: another user can't read or touch them", async () => {
  const alice = await freshAgent('alice@x.com');
  const task = await taskFor(alice);
  const c = (await alice.post(`/api/tasks/${task.id}/comments`).send({ body: 'secret' })).body;

  const bob = await freshAgent('bob@x.com');
  expect((await bob.get(`/api/tasks/${task.id}/comments`)).status).toBe(404); // task not theirs
  expect((await bob.delete(`/api/tasks/${task.id}/comments/${c.id}`)).status).toBe(404);
});

test('deleting a task cascades its comments', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  const task = (await agent.post(`/api/projects/${project.id}/tasks`).send({ title: 'T' })).body;
  await agent.post(`/api/tasks/${task.id}/comments`).send({ body: 'bye' });

  await agent.delete(`/api/projects/${project.id}/tasks/${task.id}`);
  const rows = db.prepare('SELECT COUNT(*) AS n FROM comments').get();
  expect(rows.n).toBe(0);
});
