import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(
    `DELETE FROM template_modules; DELETE FROM module_tasks; DELETE FROM modules; DELETE FROM templates;
     DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM sections; DELETE FROM projects; DELETE FROM users;`,
  );
});

// Build a project with two sections + an ungrouped task, then return the agent.
async function projectWithStructure(agent) {
  const project = (await agent.post('/api/projects').send({ name: 'Onboarding' })).body;
  const pid = project.id;
  const intro = (await agent.post(`/api/projects/${pid}/sections`).send({ name: 'Intro' })).body;
  const setup = (await agent.post(`/api/projects/${pid}/sections`).send({ name: 'Setup' })).body;
  await agent
    .post(`/api/projects/${pid}/tasks`)
    .send({ title: 'Welcome email', sectionId: intro.id, priority: 2 });
  await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'Intro call', sectionId: intro.id });
  await agent
    .post(`/api/projects/${pid}/tasks`)
    .send({ title: 'Create workspace', sectionId: setup.id });
  await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'Loose end' }); // ungrouped
  return pid;
}

async function freshAgent(email = 't@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

test('save a project as a template captures sections as modules', async () => {
  const agent = await freshAgent();
  const pid = await projectWithStructure(agent);

  const template = await agent
    .post('/api/templates/from-project')
    .send({ projectId: pid, name: 'Onboarding template' });
  expect(template.status).toBe(201);
  // 2 sections + a "General" module for the ungrouped task = 3 modules, 4 tasks.
  expect(template.body).toMatchObject({ module_count: 3, task_count: 4 });

  const full = await agent.get(`/api/templates/${template.body.id}`);
  const moduleNames = full.body.modules.map((m) => m.name);
  expect(moduleNames).toEqual(['Intro', 'Setup', 'General']);
  expect(full.body.modules[0].tasks.map((t) => t.title)).toEqual(['Welcome email', 'Intro call']);
  expect(full.body.modules[0].tasks[0].priority).toBe(2);
});

test('instantiate a template builds a matching project', async () => {
  const agent = await freshAgent();
  const pid = await projectWithStructure(agent);
  const template = (
    await agent.post('/api/templates/from-project').send({ projectId: pid, name: 'Tmpl' })
  ).body;

  const created = await agent
    .post(`/api/templates/${template.id}/instantiate`)
    .send({ name: 'New client' });
  expect(created.status).toBe(201);
  const newPid = created.body.id;
  expect(newPid).not.toBe(pid);
  expect(created.body.name).toBe('New client');

  // Sections mirror the modules (in order).
  const sections = await agent.get(`/api/projects/${newPid}/sections`);
  expect(sections.body.map((s) => s.name)).toEqual(['Intro', 'Setup', 'General']);

  // Tasks are copied into their sections with fields preserved.
  const tasks = await agent.get(`/api/projects/${newPid}/tasks`);
  expect(tasks.body.map((t) => t.title).sort()).toEqual(
    ['Create workspace', 'Intro call', 'Loose end', 'Welcome email'].sort(),
  );
  const welcome = tasks.body.find((t) => t.title === 'Welcome email');
  expect(welcome.priority).toBe(2);
  expect(welcome.section_id).toBe(sections.body.find((s) => s.name === 'Intro').id);
});

test('templates are per-user and delete cleanly', async () => {
  const alice = await freshAgent('alice@x.com');
  const pid = await projectWithStructure(alice);
  const tmpl = (await alice.post('/api/templates/from-project').send({ projectId: pid, name: 'A' }))
    .body;

  const bob = await freshAgent('bob@x.com');
  expect((await bob.get('/api/templates')).body).toHaveLength(0);
  expect((await bob.get(`/api/templates/${tmpl.id}`)).status).toBe(404);
  expect((await bob.post(`/api/templates/${tmpl.id}/instantiate`).send({ name: 'X' })).status).toBe(
    404,
  );

  expect((await alice.delete(`/api/templates/${tmpl.id}`)).status).toBe(204);
  expect((await alice.get('/api/templates')).body).toHaveLength(0);
});

test('create and edit a template from scratch (full-structure save)', async () => {
  const agent = await freshAgent('editor@x.com');

  const created = await agent.post('/api/templates').send({
    name: 'Sprint',
    modules: [
      { name: 'Planning', tasks: [{ title: 'Groom backlog' }, { title: 'Estimate' }] },
      { name: 'Build', tasks: [{ title: 'Code', priority: 3 }] },
    ],
  });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ name: 'Sprint', module_count: 2, task_count: 3 });

  // Edit: rename, drop a module, change tasks.
  const edited = await agent.patch(`/api/templates/${created.body.id}`).send({
    name: 'Sprint v2',
    modules: [{ name: 'Planning', tasks: [{ title: 'Groom backlog', priority: 2 }] }],
  });
  expect(edited.status).toBe(200);
  expect(edited.body).toMatchObject({ name: 'Sprint v2', module_count: 1, task_count: 1 });

  const full = await agent.get(`/api/templates/${created.body.id}`);
  expect(full.body.modules.map((m) => m.name)).toEqual(['Planning']);
  expect(full.body.modules[0].tasks).toEqual([
    { title: 'Groom backlog', status: 'todo', priority: 2, notes: null },
  ]);

  // Instantiating the edited template reflects the edits.
  const project = await agent
    .post(`/api/templates/${created.body.id}/instantiate`)
    .send({ name: 'From Sprint' });
  const sections = await agent.get(`/api/projects/${project.body.id}/sections`);
  expect(sections.body.map((s) => s.name)).toEqual(['Planning']);
});

test('cannot edit a template you do not own', async () => {
  const alice = await freshAgent('ta@x.com');
  const t = (await alice.post('/api/templates').send({ name: 'A' })).body;
  const bob = await freshAgent('tb@x.com');
  const res = await bob.patch(`/api/templates/${t.id}`).send({ name: 'hacked' });
  expect(res.status).toBe(404);
});

test('cannot template a project you do not own', async () => {
  const alice = await freshAgent('alice2@x.com');
  const pid = await projectWithStructure(alice);
  const bob = await freshAgent('bob2@x.com');
  const res = await bob.post('/api/templates/from-project').send({ projectId: pid, name: 'nope' });
  expect(res.status).toBe(404);
});
