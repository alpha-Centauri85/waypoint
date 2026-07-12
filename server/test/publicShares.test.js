import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(`
    DELETE FROM public_shares; DELETE FROM project_invites; DELETE FROM project_members;
    DELETE FROM comments; DELETE FROM activities;
    DELETE FROM subtasks; DELETE FROM task_labels; DELETE FROM tasks; DELETE FROM sections;
    DELETE FROM project_labels; DELETE FROM labels;
    DELETE FROM projects; DELETE FROM statuses; DELETE FROM users;
  `);
});

async function freshAgent(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

async function share(owner, projectId, agent, role) {
  const invite = (await owner.post(`/api/projects/${projectId}/members/invites`).send({ role }))
    .body;
  await agent.post(`/api/invites/${invite.token}/accept`);
}

// Build an owner with a project that exercises every visible + hidden field:
// a section, an owner label, statuses, a task with notes + subtasks (some done).
async function seedProject() {
  const owner = await freshAgent('owner@x.com');
  const project = (
    await owner.post('/api/projects').send({ name: 'Launch', description: 'SECRET_DESCRIPTION' })
  ).body;
  const section = (
    await owner.post(`/api/projects/${project.id}/sections`).send({ name: 'Phase 1' })
  ).body;
  const label = (await owner.post('/api/labels').send({ name: 'urgent', color: 'red' })).body;
  const statuses = (await owner.get('/api/statuses')).body;
  const doing = statuses.find((s) => s.key === 'doing');

  const task = (
    await owner.post(`/api/projects/${project.id}/tasks`).send({
      title: 'Ship it',
      statusId: doing.id,
      sectionId: section.id,
      priority: 3,
      dueDate: '2026-08-01',
      notes: 'SECRET_TASK_NOTES',
      labelIds: [label.id],
    })
  ).body;

  // Three subtasks, two marked done — distinctive titles so a leak is detectable.
  for (const title of ['SECRET_SUBTASK_A', 'SECRET_SUBTASK_B', 'SECRET_SUBTASK_C']) {
    const st = (await owner.post(`/api/tasks/${task.id}/subtasks`).send({ title })).body;
    if (title !== 'SECRET_SUBTASK_C')
      await owner.patch(`/api/tasks/${task.id}/subtasks/${st.id}`).send({ done: true });
  }

  return { owner, project, section, label, statuses, doing, task };
}

async function createLink(owner, projectId) {
  return (await owner.post(`/api/projects/${projectId}/members/public-share`)).body.token;
}

test('public payload has exactly the whitelisted keys and leaks nothing private', async () => {
  const { owner, project } = await seedProject();
  const token = await createLink(owner, project.id);

  // Fetch with a fresh, cookie-less client (truly no session).
  const res = await request(app).get(`/api/public/${token}`);
  expect(res.status).toBe(200);
  const body = res.body;

  // Top-level shape.
  expect(Object.keys(body).sort()).toEqual(['project', 'sections', 'statuses', 'tasks']);
  expect(Object.keys(body.project)).toEqual(['name']);
  expect(body.project.name).toBe('Launch');

  // Section shape.
  expect(Object.keys(body.sections[0]).sort()).toEqual(['id', 'name', 'position']);

  // Status shape — no user_id, no key.
  expect(Object.keys(body.statuses[0]).sort()).toEqual([
    'color',
    'id',
    'is_done',
    'name',
    'position',
  ]);

  // Task shape.
  const task = body.tasks[0];
  expect(Object.keys(task).sort()).toEqual([
    'dueDate',
    'id',
    'labels',
    'priority',
    'sectionId',
    'statusId',
    'subtaskDone',
    'subtaskTotal',
    'title',
  ]);
  expect(Object.keys(task.labels[0]).sort()).toEqual(['color', 'id', 'name']);

  // Nothing private anywhere in the serialized response.
  const raw = JSON.stringify(body);
  for (const forbidden of [
    'user_id',
    'notes',
    'SECRET_TASK_NOTES',
    'SECRET_DESCRIPTION',
    'description',
    'email',
    'owner@x.com',
    '"key"',
    'created_at',
    'created_by',
    'revoked_at',
    'SECRET_SUBTASK_A',
    'SECRET_SUBTASK_B',
    'SECRET_SUBTASK_C',
  ]) {
    expect(raw).not.toContain(forbidden);
  }
});

test('subtask progress is a correct count, never titles', async () => {
  const { owner, project } = await seedProject();
  const token = await createLink(owner, project.id);
  const task = (await request(app).get(`/api/public/${token}`)).body.tasks[0];
  expect(task.subtaskTotal).toBe(3);
  expect(task.subtaskDone).toBe(2);
});

test('statuses and labels resolve against the OWNER', async () => {
  const { owner, project, label, statuses } = await seedProject();
  const token = await createLink(owner, project.id);
  const body = (await request(app).get(`/api/public/${token}`)).body;

  expect(body.statuses.map((s) => s.id).sort()).toEqual(statuses.map((s) => s.id).sort());
  expect(body.tasks[0].labels).toEqual([{ id: label.id, name: 'urgent', color: 'red' }]);
});

test('non-GET verbs on the public endpoint never mutate (404)', async () => {
  const { owner, project } = await seedProject();
  const token = await createLink(owner, project.id);

  for (const verb of ['post', 'patch', 'delete']) {
    const res = await request(app)[verb](`/api/public/${token}`).send({ name: 'hacked' });
    expect([404, 405]).toContain(res.status);
  }
  // The project is untouched.
  expect((await request(app).get(`/api/public/${token}`)).body.project.name).toBe('Launch');
});

test('revoke makes the link 404 immediately', async () => {
  const { owner, project } = await seedProject();
  const token = await createLink(owner, project.id);
  expect((await request(app).get(`/api/public/${token}`)).status).toBe(200);

  await owner.delete(`/api/projects/${project.id}/members/public-share`).expect(204);
  expect((await request(app).get(`/api/public/${token}`)).status).toBe(404);
});

test('a revoked link and a never-existed link return identical 404 bodies', async () => {
  const { owner, project } = await seedProject();
  const token = await createLink(owner, project.id);
  await owner.delete(`/api/projects/${project.id}/members/public-share`);

  const revoked = await request(app).get(`/api/public/${token}`);
  const neverExisted = await request(app).get('/api/public/totally-made-up-token');
  expect(revoked.status).toBe(404);
  expect(neverExisted.status).toBe(404);
  expect(revoked.body).toEqual(neverExisted.body);
});

test('only the owner can create, revoke, or see the public share', async () => {
  const { owner, project } = await seedProject();
  const editor = await freshAgent('editor@x.com');
  const viewer = await freshAgent('viewer@x.com');
  const stranger = await freshAgent('stranger@x.com');
  await share(owner, project.id, editor, 'editor');
  await share(owner, project.id, viewer, 'viewer');

  // Collaborators cannot create or revoke.
  expect((await editor.post(`/api/projects/${project.id}/members/public-share`)).status).toBe(403);
  expect((await viewer.post(`/api/projects/${project.id}/members/public-share`)).status).toBe(403);
  expect((await editor.delete(`/api/projects/${project.id}/members/public-share`)).status).toBe(
    403,
  );
  // Stranger has no access at all → 404.
  expect((await stranger.post(`/api/projects/${project.id}/members/public-share`)).status).toBe(
    404,
  );

  // Owner creates the link; only the owner sees the token in the roster payload.
  await owner.post(`/api/projects/${project.id}/members/public-share`).expect(201);
  expect((await owner.get(`/api/projects/${project.id}/members`)).body.publicShare).not.toBeNull();
  expect((await editor.get(`/api/projects/${project.id}/members`)).body.publicShare).toBeNull();
  expect((await viewer.get(`/api/projects/${project.id}/members`)).body.publicShare).toBeNull();
});

test('creating a link twice is idempotent (same token, one link per project)', async () => {
  const { owner, project } = await seedProject();
  const first = await createLink(owner, project.id);
  const second = await createLink(owner, project.id);
  expect(second).toBe(first);
  expect(
    db.prepare('SELECT COUNT(*) AS c FROM public_shares WHERE project_id = ?').get(project.id).c,
  ).toBe(1);
});
