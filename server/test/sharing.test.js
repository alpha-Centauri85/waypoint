import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec(`
    DELETE FROM project_invites; DELETE FROM project_members;
    DELETE FROM comments; DELETE FROM activities;
    DELETE FROM subtasks; DELETE FROM task_labels; DELETE FROM tasks; DELETE FROM sections;
    DELETE FROM project_labels; DELETE FROM projects; DELETE FROM statuses; DELETE FROM users;
  `);
});

async function freshAgent(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password: 'password123' });
  return agent;
}

// Owner shares a project with `agent` at `role` via an invite token.
async function share(owner, projectId, agent, role) {
  const invite = (await owner.post(`/api/projects/${projectId}/members/invites`).send({ role }))
    .body;
  const res = await agent.post(`/api/invites/${invite.token}/accept`);
  expect(res.body.status).toBe('ok');
  return invite;
}

test('invite → accept makes the project appear for the collaborator with their role', async () => {
  const owner = await freshAgent('owner@x.com');
  const project = (await owner.post('/api/projects').send({ name: 'Shared' })).body;
  const bob = await freshAgent('bob@x.com');

  expect((await bob.get('/api/projects')).body).toHaveLength(0);
  await share(owner, project.id, bob, 'editor');

  const bobsProjects = (await bob.get('/api/projects')).body;
  expect(bobsProjects).toHaveLength(1);
  expect(bobsProjects[0]).toMatchObject({
    id: project.id,
    role: 'editor',
    owner_email: 'owner@x.com',
  });
});

test('editor can edit tasks; viewer is read-only; non-member has no access', async () => {
  const owner = await freshAgent('owner@x.com');
  const project = (await owner.post('/api/projects').send({ name: 'P' })).body;
  const task = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'T' })).body;

  const editor = await freshAgent('editor@x.com');
  const viewer = await freshAgent('viewer@x.com');
  const stranger = await freshAgent('stranger@x.com');
  await share(owner, project.id, editor, 'editor');
  await share(owner, project.id, viewer, 'viewer');

  // Editor can read and write.
  expect((await editor.get(`/api/projects/${project.id}/tasks`)).status).toBe(200);
  expect(
    (await editor.post(`/api/projects/${project.id}/tasks`).send({ title: 'By editor' })).status,
  ).toBe(201);

  // Viewer can read but not write.
  expect((await viewer.get(`/api/projects/${project.id}/tasks`)).status).toBe(200);
  expect(
    (await viewer.post(`/api/projects/${project.id}/tasks`).send({ title: 'Nope' })).status,
  ).toBe(403);
  expect(
    (await viewer.patch(`/api/projects/${project.id}/tasks/${task.id}`).send({ title: 'x' }))
      .status,
  ).toBe(403);

  // Stranger sees nothing.
  expect((await stranger.get(`/api/projects/${project.id}`)).status).toBe(404);
  expect((await stranger.get(`/api/projects/${project.id}/tasks`)).status).toBe(404);
});

test('only the owner can delete or manage members', async () => {
  const owner = await freshAgent('owner@x.com');
  const project = (await owner.post('/api/projects').send({ name: 'P' })).body;
  const editor = await freshAgent('editor@x.com');
  await share(owner, project.id, editor, 'editor');

  // Editor can't delete or invite others.
  expect((await editor.delete(`/api/projects/${project.id}`)).status).toBe(403);
  expect(
    (await editor.post(`/api/projects/${project.id}/members/invites`).send({ role: 'viewer' }))
      .status,
  ).toBe(403);

  // Owner sees the roster (owner + editor) and can change the role, then remove.
  const roster = (await owner.get(`/api/projects/${project.id}/members`)).body;
  expect(roster.members.map((m) => m.role).sort()).toEqual(['editor', 'owner']);
});

test('collaborator tasks use the OWNER’s statuses and labels, not their own', async () => {
  const owner = await freshAgent('owner@x.com');
  const project = (await owner.post('/api/projects').send({ name: 'P' })).body;
  const label = (await owner.post('/api/labels').send({ name: 'urgent' })).body;
  const doing = (await owner.get('/api/statuses')).body.find((s) => s.key === 'doing');

  const editor = await freshAgent('editor@x.com');
  await share(owner, project.id, editor, 'editor');

  // The editor loads the OWNER's statuses/labels for this project.
  const ownerStatuses = (await editor.get(`/api/projects/${project.id}/statuses`)).body;
  expect(ownerStatuses.some((s) => s.id === doing.id)).toBe(true);
  const ownerLabels = (await editor.get(`/api/projects/${project.id}/labels`)).body;
  expect(ownerLabels.map((l) => l.id)).toContain(label.id);

  // Editor creates a task using the owner's status + label — accepted and applied.
  const created = await editor
    .post(`/api/projects/${project.id}/tasks`)
    .send({ title: 'Owned bits', statusId: doing.id, labelIds: [label.id] });
  expect(created.status).toBe(201);
  expect(created.body.status_id).toBe(doing.id);
  expect(created.body.labels.map((l) => l.id)).toEqual([label.id]);
});

test('project activity shows every member’s actions with author attribution', async () => {
  const owner = await freshAgent('owner@x.com');
  const project = (await owner.post('/api/projects').send({ name: 'P' })).body;
  const editor = await freshAgent('editor@x.com');
  await share(owner, project.id, editor, 'editor');
  await editor.post(`/api/projects/${project.id}/tasks`).send({ title: 'From editor' });

  // The owner sees the editor's action in the project feed, attributed to them.
  const feed = (await owner.get(`/api/activities?projectId=${project.id}`)).body;
  const entry = feed.find((a) => a.summary === 'Added task “From editor”');
  expect(entry.author_email).toBe('editor@x.com');
});

test('a used invite token cannot be accepted again', async () => {
  const owner = await freshAgent('owner@x.com');
  const project = (await owner.post('/api/projects').send({ name: 'P' })).body;
  const bob = await freshAgent('bob@x.com');
  const invite = (
    await owner.post(`/api/projects/${project.id}/members/invites`).send({ role: 'viewer' })
  ).body;

  expect((await bob.post(`/api/invites/${invite.token}/accept`)).body.status).toBe('ok');
  const carol = await freshAgent('carol@x.com');
  expect((await carol.post(`/api/invites/${invite.token}/accept`)).body.status).toBe('used');
});
