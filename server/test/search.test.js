import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec('DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users;');
});

async function freshAgent(email = 's@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

test('search finds matching projects and tasks (by title and notes)', async () => {
  const agent = await freshAgent();
  const proj = (await agent.post('/api/projects').send({ name: 'Website Redesign' })).body;
  await agent.post('/api/projects').send({ name: 'Payroll' });
  await agent.post(`/api/projects/${proj.id}/tasks`).send({ title: 'Design the homepage' });
  await agent
    .post(`/api/projects/${proj.id}/tasks`)
    .send({ title: 'Ship it', notes: 'needs a homepage review' });

  const res = await agent.get('/api/search').query({ q: 'homepage' });
  expect(res.status).toBe(200);
  // Matches the two tasks (title + notes), not the projects.
  expect(res.body.tasks.map((t) => t.title).sort()).toEqual(['Design the homepage', 'Ship it']);
  expect(res.body.tasks[0]).toHaveProperty('project_name', 'Website Redesign');

  const byProject = await agent.get('/api/search').query({ q: 'redesign' });
  expect(byProject.body.projects.map((p) => p.name)).toEqual(['Website Redesign']);
});

test('short queries return nothing', async () => {
  const agent = await freshAgent();
  await agent.post('/api/projects').send({ name: 'Ab' });
  const res = await agent.get('/api/search').query({ q: 'a' });
  expect(res.body).toEqual({ projects: [], tasks: [] });
});

test('LIKE wildcards in the query are treated literally', async () => {
  const agent = await freshAgent();
  await agent.post('/api/projects').send({ name: 'Real project' });
  await agent.post('/api/projects').send({ name: '100% done' });

  // "%%" should not match everything — only the literal "%".
  const res = await agent.get('/api/search').query({ q: '100%' });
  expect(res.body.projects.map((p) => p.name)).toEqual(['100% done']);
});

test('search is scoped to the user', async () => {
  const alice = await freshAgent('alice@x.com');
  await alice.post('/api/projects').send({ name: 'Alice secret plan' });

  const bob = await freshAgent('bob@x.com');
  const res = await bob.get('/api/search').query({ q: 'secret' });
  expect(res.body.projects).toEqual([]);
});
