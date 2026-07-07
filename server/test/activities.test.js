import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(`
    DELETE FROM activities;
    DELETE FROM subtasks; DELETE FROM task_labels; DELETE FROM tasks; DELETE FROM sections;
    DELETE FROM project_labels; DELETE FROM projects; DELETE FROM statuses; DELETE FROM users;
  `);
});

async function freshAgent(email = 't@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

test('project and task lifecycle events are logged with readable summaries', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'Launch' })).body;
  const task = (await agent.post(`/api/projects/${project.id}/tasks`).send({ title: 'Ship it' }))
    .body;

  // A non-default status to move the task to.
  const statuses = (await agent.get('/api/statuses')).body;
  const doing = statuses.find((s) => s.key === 'doing') ?? statuses[1];
  await agent
    .patch(`/api/projects/${project.id}/tasks/${task.id}`)
    .send({ statusId: doing.id, priority: 3 });

  const feed = (await agent.get(`/api/activities?projectId=${project.id}`)).body;
  const actions = feed.map((a) => a.action);
  // Most-recent-first: status change, then create task, then create project.
  expect(actions).toEqual(['task.status_changed', 'task.created', 'project.created']);
  expect(feed[0].summary).toContain(doing.name);
  expect(feed[0].summary).toContain('priority → high');
  expect(feed[2].summary).toBe('Created project “Launch”');
});

test('deleting a task keeps a record even though the task is gone', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  const task = (await agent.post(`/api/projects/${project.id}/tasks`).send({ title: 'Temp' })).body;
  await agent.delete(`/api/projects/${project.id}/tasks/${task.id}`);

  const feed = (await agent.get(`/api/activities?projectId=${project.id}`)).body;
  const del = feed.find((a) => a.action === 'task.deleted');
  expect(del.summary).toBe('Deleted task “Temp”');
  expect(del.task_id).toBeNull(); // FK nulled on delete, summary survives
});

test('activity is per-user and filterable by task', async () => {
  const alice = await freshAgent('alice@x.com');
  const project = (await alice.post('/api/projects').send({ name: 'A' })).body;
  const t1 = (await alice.post(`/api/projects/${project.id}/tasks`).send({ title: 'One' })).body;
  await alice.post(`/api/projects/${project.id}/tasks`).send({ title: 'Two' });

  const forT1 = (await alice.get(`/api/activities?taskId=${t1.id}`)).body;
  expect(forT1).toHaveLength(1);
  expect(forT1[0].summary).toBe('Added task “One”');

  const bob = await freshAgent('bob@x.com');
  expect((await bob.get('/api/activities')).body).toHaveLength(0);
});
