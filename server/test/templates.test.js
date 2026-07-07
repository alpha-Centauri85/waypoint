import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(`
    DELETE FROM template_subtasks; DELETE FROM template_tasks; DELETE FROM template_section_labels;
    DELETE FROM template_sections; DELETE FROM templates;
    DELETE FROM module_subtasks; DELETE FROM module_labels; DELETE FROM module_tasks; DELETE FROM modules;
    DELETE FROM subtasks; DELETE FROM task_labels; DELETE FROM tasks; DELETE FROM sections;
    DELETE FROM project_labels; DELETE FROM projects; DELETE FROM statuses; DELETE FROM users;
  `);
});

async function freshAgent(email = 't@x.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

test('save a project as a template captures sections, tasks, and subtasks', async () => {
  const agent = await freshAgent();
  const project = (await agent.post('/api/projects').send({ name: 'Onboarding' })).body;
  const pid = project.id;
  const intro = (await agent.post(`/api/projects/${pid}/sections`).send({ name: 'Intro' })).body;
  const t1 = (
    await agent
      .post(`/api/projects/${pid}/tasks`)
      .send({ title: 'Welcome email', sectionId: intro.id })
  ).body;
  await agent.post(`/api/tasks/${t1.id}/subtasks`).send({ title: 'Draft copy' });
  await agent.post(`/api/projects/${pid}/tasks`).send({ title: 'Loose end' }); // ungrouped

  const template = await agent
    .post('/api/templates/from-project')
    .send({ projectId: pid, name: 'Onboarding template' });
  expect(template.status).toBe(201);
  expect(template.body).toMatchObject({ section_count: 2, task_count: 2 });

  const full = await agent.get(`/api/templates/${template.body.id}`);
  expect(full.body.sections.map((s) => s.name)).toEqual(['Intro', 'General']);
  expect(full.body.sections[0].tasks[0]).toMatchObject({ title: 'Welcome email' });
  expect(full.body.sections[0].tasks[0].subtasks).toEqual(['Draft copy']);
});

test('create + edit a template with sections, subtasks, and a label slot', async () => {
  const agent = await freshAgent();
  const legal = (await agent.post('/api/labels').send({ name: 'legal' })).body;

  const created = await agent.post('/api/templates').send({
    name: 'Client kickoff',
    sections: [
      {
        name: 'Intro',
        labelIds: [legal.id],
        tasks: [{ title: 'Say hello', subtasks: ['Email', 'Call'] }],
      },
    ],
  });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ section_count: 1, task_count: 1 });

  const full = await agent.get(`/api/templates/${created.body.id}`);
  expect(full.body.sections[0].labelIds).toEqual([legal.id]);
  expect(full.body.sections[0].tasks[0].subtasks).toEqual(['Email', 'Call']);

  // Edit: rename + drop the label slot.
  const edited = await agent.patch(`/api/templates/${created.body.id}`).send({
    name: 'Client kickoff v2',
    sections: [{ name: 'Intro', labelIds: [], tasks: [{ title: 'Say hello' }] }],
  });
  expect(edited.body.name).toBe('Client kickoff v2');
  const after = await agent.get(`/api/templates/${created.body.id}`);
  expect(after.body.sections[0].labelIds).toEqual([]);
});

test('instantiating injects modules into sections by matching label', async () => {
  const agent = await freshAgent();
  const legal = (await agent.post('/api/labels').send({ name: 'legal' })).body;

  // A library module tagged #legal with two tasks (one with subtasks).
  await agent.post('/api/modules').send({
    name: 'Legal review',
    labelIds: [legal.id],
    tasks: [{ title: 'NDA' }, { title: 'Contract', subtasks: ['Draft', 'Sign'] }],
  });

  // A template whose "Onboarding" section is flagged #legal + has a fixed task.
  const template = (
    await agent.post('/api/templates').send({
      name: 'Client onboarding',
      sections: [{ name: 'Onboarding', labelIds: [legal.id], tasks: [{ title: 'Welcome' }] }],
    })
  ).body;

  const created = await agent
    .post(`/api/templates/${template.id}/instantiate`)
    .send({ name: 'Acme onboarding' });
  const newPid = created.body.id;

  const sections = await agent.get(`/api/projects/${newPid}/sections`);
  expect(sections.body.map((s) => s.name)).toEqual(['Onboarding']);

  const tasks = await agent.get(`/api/projects/${newPid}/tasks`);
  // Fixed task first, then the injected module's tasks.
  expect(tasks.body.map((t) => t.title)).toEqual(['Welcome', 'NDA', 'Contract']);

  const contract = tasks.body.find((t) => t.title === 'Contract');
  const subs = await agent.get(`/api/tasks/${contract.id}/subtasks`);
  expect(subs.body.map((s) => s.title)).toEqual(['Draft', 'Sign']);
});

test('templates are per-user; editing / instantiating others is 404', async () => {
  const alice = await freshAgent('alice@x.com');
  const t = (await alice.post('/api/templates').send({ name: 'A' })).body;
  const bob = await freshAgent('bob@x.com');
  expect((await bob.get('/api/templates')).body).toHaveLength(0);
  expect((await bob.patch(`/api/templates/${t.id}`).send({ name: 'x' })).status).toBe(404);
  expect((await bob.post(`/api/templates/${t.id}/instantiate`).send({ name: 'y' })).status).toBe(
    404,
  );
});
