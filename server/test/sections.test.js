import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(
    'DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM sections; DELETE FROM projects; DELETE FROM users;',
  );
});

async function setup() {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 's@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'P' });
  return { agent, projectId: project.body.id };
}

test('sections: create, list, rename, reorder, delete', async () => {
  const { agent, projectId } = await setup();
  const base = `/api/projects/${projectId}/sections`;

  const a = (await agent.post(base).send({ name: 'Intro' })).body;
  const b = (await agent.post(base).send({ name: 'Build' })).body;
  expect((await agent.get(base)).body.map((s) => s.name)).toEqual(['Intro', 'Build']);

  const renamed = await agent.patch(`${base}/${a.id}`).send({ name: 'Kickoff' });
  expect(renamed.body.name).toBe('Kickoff');

  const reordered = await agent.patch(`${base}/reorder`).send({ orderedIds: [b.id, a.id] });
  expect(reordered.body.map((s) => s.name)).toEqual(['Build', 'Kickoff']);

  await agent.delete(`${base}/${a.id}`);
  expect((await agent.get(base)).body.map((s) => s.name)).toEqual(['Build']);
});

test('a task can be assigned to a section and moved between sections', async () => {
  const { agent, projectId } = await setup();
  const secBase = `/api/projects/${projectId}/sections`;
  const taskBase = `/api/projects/${projectId}/tasks`;
  const intro = (await agent.post(secBase).send({ name: 'Intro' })).body;
  const build = (await agent.post(secBase).send({ name: 'Build' })).body;

  const task = await agent.post(taskBase).send({ title: 'Welcome email', sectionId: intro.id });
  expect(task.body.section_id).toBe(intro.id);

  const moved = await agent.patch(`${taskBase}/${task.body.id}`).send({ sectionId: build.id });
  expect(moved.body.section_id).toBe(build.id);

  const ungrouped = await agent.patch(`${taskBase}/${task.body.id}`).send({ sectionId: null });
  expect(ungrouped.body.section_id).toBeNull();
});

test('deleting a section ungroups its tasks (does not delete them)', async () => {
  const { agent, projectId } = await setup();
  const secBase = `/api/projects/${projectId}/sections`;
  const taskBase = `/api/projects/${projectId}/tasks`;
  const section = (await agent.post(secBase).send({ name: 'Temp' })).body;
  await agent.post(taskBase).send({ title: 'Survives', sectionId: section.id });

  await agent.delete(`${secBase}/${section.id}`);

  const list = await agent.get(taskBase);
  expect(list.body.map((t) => t.title)).toEqual(['Survives']);
  expect(list.body[0].section_id).toBeNull();
});

test("a task cannot be assigned to another project's section", async () => {
  const { agent, projectId } = await setup();
  const other = (await agent.post('/api/projects').send({ name: 'Other' })).body;
  const foreignSection = (
    await agent.post(`/api/projects/${other.id}/sections`).send({ name: 'Nope' })
  ).body;

  const res = await agent
    .post(`/api/projects/${projectId}/tasks`)
    .send({ title: 'X', sectionId: foreignSection.id });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/section/i);
});
