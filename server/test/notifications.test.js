import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';
import { runReminders } from '../src/models/notifications.js';

const app = createApp();

// A fixed "today" so due-date logic is deterministic regardless of the machine's
// clock/timezone. Tasks below are dated relative to it.
const TODAY = '2026-07-12';
const YESTERDAY = '2026-07-11';
const TOMORROW = '2026-07-13';

beforeEach(() => {
  db.exec(`
    DELETE FROM notifications; DELETE FROM activities;
    DELETE FROM subtasks; DELETE FROM task_labels; DELETE FROM tasks; DELETE FROM sections;
    DELETE FROM project_members; DELETE FROM project_invites;
    DELETE FROM project_labels; DELETE FROM projects; DELETE FROM statuses; DELETE FROM users;
  `);
});

async function freshAgent(email = 't@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

const addTask = (agent, projectId, title, extra) =>
  agent.post(`/api/projects/${projectId}/tasks`).send({ title, ...extra });

test('sweep reminds on due-today and overdue tasks, but not future or done ones', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'Launch' })).body;
  const doneStatus = (await agent.get('/api/statuses')).body.find((s) => s.is_done === 1);

  await addTask(agent, project.id, 'Due today', { dueDate: TODAY });
  await addTask(agent, project.id, 'Overdue', { dueDate: YESTERDAY });
  await addTask(agent, project.id, 'Future', { dueDate: TOMORROW });
  await addTask(agent, project.id, 'No due date', {});
  await addTask(agent, project.id, 'Done but overdue', {
    dueDate: YESTERDAY,
    statusId: doneStatus.id,
  });

  const created = runReminders({ today: TODAY });
  expect(created).toBe(2);

  const { items, unreadCount } = (await agent.get('/api/notifications')).body;
  expect(unreadCount).toBe(2);
  const messages = items.map((n) => n.message).sort();
  expect(messages).toEqual(['Due today: Due today', 'Overdue: Overdue']);
  // Every reminder carries the project for the click-through.
  expect(items.every((n) => n.project_id === project.id)).toBe(true);
});

test('re-running the sweep does not duplicate reminders (idempotent)', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  await addTask(agent, project.id, 'Overdue', { dueDate: YESTERDAY });

  expect(runReminders({ today: TODAY })).toBe(1);
  expect(runReminders({ today: TODAY })).toBe(0);
  expect((await agent.get('/api/notifications')).body.unreadCount).toBe(1);
});

test('rescheduling a task to a new due date can remind again', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  const task = (await addTask(agent, project.id, 'Slippery', { dueDate: YESTERDAY })).body;
  runReminders({ today: TODAY });

  await agent.patch(`/api/projects/${project.id}/tasks/${task.id}`).send({ dueDate: TODAY });
  expect(runReminders({ today: TODAY })).toBe(1);
  expect((await agent.get('/api/notifications')).body.unreadCount).toBe(2);
});

test('marking notifications read clears the unread count', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  await addTask(agent, project.id, 'A', { dueDate: YESTERDAY });
  await addTask(agent, project.id, 'B', { dueDate: TODAY });
  runReminders({ today: TODAY });

  const { items } = (await agent.get('/api/notifications')).body;
  await agent.post(`/api/notifications/${items[0].id}/read`).expect(200);
  expect((await agent.get('/api/notifications')).body.unreadCount).toBe(1);

  await agent.post('/api/notifications/read-all').expect(200);
  expect((await agent.get('/api/notifications')).body.unreadCount).toBe(0);

  // Marking an unknown notification 404s.
  await agent.post('/api/notifications/999999/read').expect(404);
});

test('reminders are per-user and reach shared-project members', async () => {
  const alice = await freshAgent('alice@x.com');
  const bob = await freshAgent('bob@x.com');
  const project = (await alice.post('/api/projects').send({ name: 'Shared' })).body;
  await addTask(alice, project.id, 'Team task', { dueDate: YESTERDAY });

  // Share with bob as a viewer.
  const invite = (
    await alice.post(`/api/projects/${project.id}/members/invites`).send({
      role: 'viewer',
    })
  ).body;
  await bob.post(`/api/invites/${invite.token}/accept`).expect(200);

  runReminders({ today: TODAY });

  expect((await alice.get('/api/notifications')).body.unreadCount).toBe(1);
  expect((await bob.get('/api/notifications')).body.unreadCount).toBe(1);

  // A stranger sees nothing.
  const carol = await freshAgent('carol@x.com');
  expect((await carol.get('/api/notifications')).body.unreadCount).toBe(0);
});

test('the run endpoint triggers the sweep on demand', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'P' })).body;
  // Date the task in the past so it's overdue regardless of the real clock.
  await addTask(agent, project.id, 'Old', { dueDate: '2000-01-01' });

  const { created } = (await agent.post('/api/notifications/run')).body;
  expect(created).toBeGreaterThanOrEqual(1);
  expect((await agent.get('/api/notifications')).body.unreadCount).toBeGreaterThanOrEqual(1);
});
