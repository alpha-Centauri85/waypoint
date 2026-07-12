import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(`
    DELETE FROM project_invites; DELETE FROM project_members;
    DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM sections;
    DELETE FROM projects; DELETE FROM users;
  `);
});

async function setup() {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email: 's@x.com', password: 'password123' });
  const project = await agent.post('/api/projects').send({ name: 'P' });
  return { agent, projectId: project.body.id };
}

async function freshAgent(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

// Owner shares a project with `agent` at `role` via an invite token.
async function share(owner, projectId, agent, role) {
  const invite = (await owner.post(`/api/projects/${projectId}/members/invites`).send({ role }))
    .body;
  await agent.post(`/api/invites/${invite.token}/accept`);
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

test('a section description can be set on create, changed, cleared, and round-trips on GET', async () => {
  const { agent, projectId } = await setup();
  const base = `/api/projects/${projectId}/sections`;

  // Create with a description.
  const created = (
    await agent.post(base).send({ name: 'Intro', description: 'Kickoff and onboarding' })
  ).body;
  expect(created.description).toBe('Kickoff and onboarding');

  // Round-trips on GET.
  const listed = (await agent.get(base)).body;
  expect(listed.find((s) => s.id === created.id).description).toBe('Kickoff and onboarding');

  // Create with no description at all → null.
  const bare = (await agent.post(base).send({ name: 'Build' })).body;
  expect(bare.description).toBeNull();

  // PATCH to change the description.
  const changed = await agent
    .patch(`${base}/${created.id}`)
    .send({ description: 'Updated description' });
  expect(changed.body.description).toBe('Updated description');

  // PATCH name only leaves description untouched.
  const renamed = await agent.patch(`${base}/${created.id}`).send({ name: 'Kickoff' });
  expect(renamed.body.name).toBe('Kickoff');
  expect(renamed.body.description).toBe('Updated description');

  // Explicit null clears it.
  const cleared = await agent.patch(`${base}/${created.id}`).send({ description: null });
  expect(cleared.body.description).toBeNull();
});

test('a section description over the length limit is rejected', async () => {
  const { agent, projectId } = await setup();
  const base = `/api/projects/${projectId}/sections`;
  const res = await agent.post(base).send({ name: 'Intro', description: 'x'.repeat(10001) });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/description/i);
});

test('a viewer cannot PATCH a section description (403)', async () => {
  const owner = await freshAgent('owner2@x.com');
  const project = (await owner.post('/api/projects').send({ name: 'Shared' })).body;
  const base = `/api/projects/${project.id}/sections`;
  const section = (await owner.post(base).send({ name: 'Intro' })).body;

  const viewer = await freshAgent('viewer2@x.com');
  await share(owner, project.id, viewer, 'viewer');

  const res = await viewer
    .patch(`${base}/${section.id}`)
    .send({ description: 'Should not be allowed' });
  expect(res.status).toBe(403);

  // Confirm nothing changed.
  const unchanged = (await owner.get(base)).body.find((s) => s.id === section.id);
  expect(unchanged.description).toBeNull();
});
