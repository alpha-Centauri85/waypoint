import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec('DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users;');
});

// A logged-in agent with one project, for exercising task/subtask validation.
async function agentWithProject() {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 'v@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'P' });
  return { agent, projectId: project.body.id };
}

test('register rejects an invalid email with a 400 and a message', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'not-an-email', password: 'password123' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/email/i);
});

test('register rejects a short password with a 400', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: 'a@x.com', password: 'short' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/password.*8/i);
});

test('email is normalized (trimmed + lower-cased) so login is case-insensitive', async () => {
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: '  Lee@Example.COM ', password: 'password123' });
  expect(reg.status).toBe(201);
  expect(reg.body.email).toBe('lee@example.com');

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'LEE@example.com', password: 'password123' });
  expect(login.status).toBe(200);
});

test('creating a project without a name is a 400', async () => {
  const { agent } = await agentWithProject();
  const res = await agent.post('/api/projects').send({ description: 'no name' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/name/i);
});

test('unknown body keys are stripped, not persisted', async () => {
  const { agent } = await agentWithProject();
  const res = await agent.post('/api/projects').send({ name: 'Clean', role: 'admin', id: 999 });
  expect(res.status).toBe(201);
  expect(res.body.name).toBe('Clean');
  expect(res.body.id).not.toBe(999); // client-supplied id was ignored
  expect(res.body).not.toHaveProperty('role');
});

test('an invalid task status is a 400 (caught before the DB)', async () => {
  const { agent, projectId } = await agentWithProject();
  const res = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: 'X', status: 'bogus' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/status/i);
});

test('a malformed due date is a 400', async () => {
  const { agent, projectId } = await agentWithProject();
  const res = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: 'X', dueDate: 'next tuesday' });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/date/i);
});

test('a well-formed task with notes and due date is accepted', async () => {
  const { agent, projectId } = await agentWithProject();
  const res = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: '  Ship it  ', dueDate: '2026-08-01', notes: 'do the thing' });
  expect(res.status).toBe(201);
  expect(res.body.title).toBe('Ship it'); // trimmed
  expect(res.body.due_date).toBe('2026-08-01');
  expect(res.body.notes).toBe('do the thing');
});

test('an explicit null clears a task due date and notes (presence-based merge)', async () => {
  const { agent, projectId } = await agentWithProject();
  const task = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: 'T', dueDate: '2026-08-01', notes: 'stuff' });
  expect(task.body.due_date).toBe('2026-08-01');

  // A status-only patch must leave the due date and notes untouched.
  const bumped = await agent
    .patch(`/api/projects/${projectId}/tasks/${task.body.id}`)
    .send({ status: 'doing' });
  expect(bumped.body.due_date).toBe('2026-08-01');
  expect(bumped.body.notes).toBe('stuff');

  // Explicit nulls clear them.
  const cleared = await agent
    .patch(`/api/projects/${projectId}/tasks/${task.body.id}`)
    .send({ dueDate: null, notes: null });
  expect(cleared.body.due_date).toBeNull();
  expect(cleared.body.notes).toBeNull();
});

test('editing a project name and clearing its description works', async () => {
  const { agent } = await agentWithProject();
  const created = await agent.post('/api/projects').send({ name: 'Old', description: 'desc' });
  const updated = await agent
    .patch(`/api/projects/${created.body.id}`)
    .send({ name: 'New', description: null });
  expect(updated.body.name).toBe('New');
  expect(updated.body.description).toBeNull();
});

test('a subtask without a title is a 400', async () => {
  const { agent, projectId } = await agentWithProject();
  const task = await agent.post(`/api/projects/${projectId}/tasks`).send({ title: 'T' });
  const res = await agent.post(`/api/tasks/${task.body.id}/subtasks`).send({});
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/title/i);
});
