import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(
    'DELETE FROM module_subtasks; DELETE FROM module_labels; DELETE FROM module_tasks; DELETE FROM modules; DELETE FROM labels; DELETE FROM users;',
  );
});

async function freshAgent(email = 'm@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

test('create a module with labels, tasks, and subtasks', async () => {
  const agent = await freshAgent();
  const label = (await agent.post('/api/labels').send({ name: 'legal', color: 'blue' })).body;

  const created = await agent.post('/api/modules').send({
    name: 'Legal review',
    labelIds: [label.id],
    tasks: [
      { title: 'NDA', priority: 3 },
      { title: 'Contract', subtasks: ['Draft', 'Sign'] },
    ],
  });
  expect(created.status).toBe(201);
  expect(created.body.labels.map((l) => l.name)).toEqual(['legal']);
  expect(created.body.tasks.map((t) => t.title)).toEqual(['NDA', 'Contract']);
  expect(created.body.tasks[1].subtasks).toEqual(['Draft', 'Sign']);

  const list = await agent.get('/api/modules');
  expect(list.body[0]).toMatchObject({ name: 'Legal review', task_count: 2 });
  expect(list.body[0].labels.map((l) => l.name)).toEqual(['legal']);
});

test('bulk-create several modules at once', async () => {
  const agent = await freshAgent();
  const res = await agent.post('/api/modules/bulk').send({ names: ['Kickoff', 'QA', 'Launch'] });
  expect(res.status).toBe(201);
  expect((await agent.get('/api/modules')).body.map((m) => m.name).sort()).toEqual([
    'Kickoff',
    'Launch',
    'QA',
  ]);
});

test('update replaces a module’s tasks and labels', async () => {
  const agent = await freshAgent();
  const a = (await agent.post('/api/labels').send({ name: 'a' })).body;
  const b = (await agent.post('/api/labels').send({ name: 'b' })).body;
  const module = (
    await agent
      .post('/api/modules')
      .send({ name: 'M', labelIds: [a.id], tasks: [{ title: 'One' }] })
  ).body;

  const updated = await agent.patch(`/api/modules/${module.id}`).send({
    labelIds: [b.id],
    tasks: [{ title: 'Two' }, { title: 'Three' }],
  });
  expect(updated.body.labels.map((l) => l.name)).toEqual(['b']);
  expect(updated.body.tasks.map((t) => t.title)).toEqual(['Two', 'Three']);
});

test('delete + per-user isolation', async () => {
  const alice = await freshAgent('alice@x.com');
  const m = (await alice.post('/api/modules').send({ name: 'Secret' })).body;
  const bob = await freshAgent('bob@x.com');
  expect((await bob.get('/api/modules')).body).toHaveLength(0);
  expect((await bob.get(`/api/modules/${m.id}`)).status).toBe(404);
  expect((await alice.delete(`/api/modules/${m.id}`)).status).toBe(204);
  expect((await alice.get('/api/modules')).body).toHaveLength(0);
});
