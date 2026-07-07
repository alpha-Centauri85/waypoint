import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';
import { getProjectById } from './projects.js';

// Project sharing: membership + access resolution + token invites. The project
// owner is projects.user_id (implicit role 'owner'); project_members holds the
// editor/viewer collaborators. "Access" = owner OR a member row.

const memberRow = db.prepare(
  'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
);
const projectOwner = db.prepare('SELECT user_id FROM projects WHERE id = ?');

// The user's role on a project: 'owner' | 'editor' | 'viewer' | null (no access).
export function roleFor(projectId, userId) {
  const owner = projectOwner.get(projectId);
  if (!owner) return null;
  if (owner.user_id === userId) return 'owner';
  return memberRow.get(projectId, userId)?.role ?? null;
}

// Authorize a user for a project. Returns { project, role } or null. The project
// is fetched unscoped (getProjectById) *after* the role check confirms access.
export function getProjectAccess(projectId, userId) {
  const role = roleFor(projectId, userId);
  if (!role) return null;
  const project = getProjectById(projectId);
  if (!project) return null;
  return { project, role };
}

// --- members ---

const membersByProject = db.prepare(`
  SELECT pm.user_id, u.email, pm.role, pm.created_at
  FROM project_members pm JOIN users u ON u.id = pm.user_id
  WHERE pm.project_id = ? ORDER BY u.email COLLATE NOCASE
`);
const ownerInfo = db.prepare(`
  SELECT p.user_id, u.email FROM projects p JOIN users u ON u.id = p.user_id WHERE p.id = ?
`);
const upsertMember = db.prepare(`
  INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role
`);
const updateRole = db.prepare(
  'UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?',
);
const removeRow = db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?');

// Owner (first) + collaborators, each { user_id, email, role }.
export function listMembers(projectId) {
  const owner = ownerInfo.get(projectId);
  if (!owner) return [];
  return [
    { user_id: owner.user_id, email: owner.email, role: 'owner' },
    ...membersByProject.all(projectId),
  ];
}

export function setMemberRole(projectId, userId, role) {
  return updateRole.run(role, projectId, userId).changes > 0;
}

export function removeMember(projectId, userId) {
  return removeRow.run(projectId, userId).changes > 0;
}

// --- invites (shareable tokens) ---

const insertInvite = db.prepare(
  'INSERT INTO project_invites (project_id, token, role, created_by, expires_at) VALUES (?, ?, ?, ?, ?)',
);
const inviteByToken = db.prepare('SELECT * FROM project_invites WHERE token = ?');
const invitesByProject = db.prepare(`
  SELECT i.*, u.email AS created_by_email
  FROM project_invites i JOIN users u ON u.id = i.created_by
  WHERE i.project_id = ? AND i.accepted_at IS NULL
  ORDER BY i.created_at DESC
`);
const markAccepted = db.prepare(
  "UPDATE project_invites SET accepted_at = datetime('now'), accepted_by = ? WHERE id = ?",
);
const deleteInvite = db.prepare('DELETE FROM project_invites WHERE id = ? AND project_id = ?');

export function createInvite(projectId, role, createdBy, { expiresInDays = 14 } = {}) {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 864e5).toISOString().replace('T', ' ').slice(0, 19)
    : null;
  insertInvite.run(projectId, token, role, createdBy, expiresAt);
  return inviteByToken.get(token);
}

export function listInvites(projectId) {
  return invitesByProject.all(projectId);
}

export function revokeInvite(id, projectId) {
  return deleteInvite.run(id, projectId).changes > 0;
}

// Public preview of an invite (for the accept screen). Returns status + context
// without requiring project access. status: 'ok' | 'not_found' | 'used' | 'expired'.
const inviteContext = db.prepare(`
  SELECT i.token, i.role, i.accepted_at, i.expires_at,
         p.name AS project_name, inviter.email AS inviter_email
  FROM project_invites i
  JOIN projects p ON p.id = i.project_id
  JOIN users inviter ON inviter.id = i.created_by
  WHERE i.token = ?
`);

export function previewInvite(token) {
  const row = inviteContext.get(token);
  if (!row) return { status: 'not_found' };
  if (row.accepted_at) return { status: 'used' };
  if (row.expires_at && row.expires_at < new Date().toISOString().replace('T', ' ').slice(0, 19))
    return { status: 'expired' };
  return {
    status: 'ok',
    role: row.role,
    projectName: row.project_name,
    inviterEmail: row.inviter_email,
  };
}

// Accept an invite as `userId`: create/upgrade the membership and consume the
// token. Returns { status, projectId } — status 'ok' | 'not_found' | 'used' |
// 'expired' | 'owner' (the owner can't accept their own project).
export const acceptInvite = db.transaction((token, userId) => {
  const invite = inviteByToken.get(token);
  if (!invite) return { status: 'not_found' };
  if (invite.accepted_at) return { status: 'used' };
  if (
    invite.expires_at &&
    invite.expires_at < new Date().toISOString().replace('T', ' ').slice(0, 19)
  )
    return { status: 'expired' };
  if (projectOwner.get(invite.project_id)?.user_id === userId)
    return { status: 'owner', projectId: invite.project_id };
  upsertMember.run(invite.project_id, userId, invite.role);
  markAccepted.run(userId, invite.id);
  return { status: 'ok', projectId: invite.project_id };
});
