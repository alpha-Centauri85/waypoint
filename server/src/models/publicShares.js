import { randomBytes } from 'node:crypto';
import { db } from '../db/index.js';

// Public, no-login, read-only share links (roadmap 29). Deliberately SEPARATE
// from the invite/membership system: a public share grants NO account, NO
// session, NO membership — only a whitelisted, read-only projection of a project
// to anyone holding the token. One link per project (UNIQUE(project_id)); revoke
// deletes the row (immediate). Token uses the same 192-bit recipe as invites.
//
// SECURITY: the public projection (getPublicProject) is built exclusively from
// dedicated named-column queries in THIS file. It must never reuse the generic
// get*/list* helpers (they SELECT * and would leak owner user_id, task notes,
// status keys, author emails, project description, timestamps, etc.). Statuses
// and labels are resolved against the project OWNER, matching how tasks are
// tagged. Subtasks surface as a progress COUNT only — never their titles.

const insert = db.prepare(
  'INSERT INTO public_shares (project_id, token, created_by) VALUES (?, ?, ?)',
);
const byProject = db.prepare(
  'SELECT * FROM public_shares WHERE project_id = ? AND revoked_at IS NULL',
);
const deleteByProject = db.prepare('DELETE FROM public_shares WHERE project_id = ?');

// The active share for a project (or undefined). Only ever one, since revoke
// deletes the row; the revoked_at filter is defensive.
export function getActiveShareByProject(projectId) {
  return byProject.get(projectId);
}

// Create (or return the existing) public share for a project. Idempotent: if an
// active link already exists we return it rather than rotating the token, so a
// previously copied URL keeps working.
export function createShare(projectId, userId) {
  const existing = byProject.get(projectId);
  if (existing) return existing;
  const token = randomBytes(24).toString('base64url');
  insert.run(projectId, token, userId);
  return byProject.get(projectId);
}

// Revoke = delete the row (immediate). Returns true if something was removed.
export function revokeShare(projectId) {
  return deleteByProject.run(projectId).changes > 0;
}

// --- the public projection (whitelist read) ---

// Resolve the token to the bare context we need: project id + name + owner id.
// Explicit columns only — no SELECT *; the owner id never reaches the client.
const shareContext = db.prepare(`
  SELECT ps.project_id AS project_id, p.name AS project_name, p.user_id AS owner_id
  FROM public_shares ps
  JOIN projects p ON p.id = ps.project_id
  WHERE ps.token = ? AND ps.revoked_at IS NULL
`);

// Sections: id/name/position only.
const sectionsForProject = db.prepare(
  'SELECT id, name, position FROM sections WHERE project_id = ? ORDER BY position, created_at',
);

// The OWNER's workflow statuses. NO user_id, NO key.
const statusesForOwner = db.prepare(
  'SELECT id, name, color, position, is_done FROM statuses WHERE user_id = ? ORDER BY position',
);

// Tasks: whitelisted display fields only (no notes, no created_at). Aliased to
// the client's camelCase contract.
const tasksForProject = db.prepare(`
  SELECT id,
         section_id AS sectionId,
         title,
         status_id  AS statusId,
         due_date   AS dueDate,
         priority
  FROM tasks
  WHERE project_id = ?
  ORDER BY position, created_at
`);

// Labels for a set of tasks (id/name/color — the same public shape as elsewhere),
// grouped by task id. Dedicated query so this file owns exactly what it exposes.
function labelsByTask(taskIds) {
  if (!taskIds.length) return {};
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT tl.task_id AS task_id, l.id, l.name, l.color
       FROM labels l
       JOIN task_labels tl ON tl.label_id = l.id
       WHERE tl.task_id IN (${placeholders})
       ORDER BY l.name COLLATE NOCASE`,
    )
    .all(...taskIds);
  const map = {};
  for (const { task_id, ...label } of rows) (map[task_id] ??= []).push(label);
  return map;
}

// Subtask progress per task: a COUNT of done + total. NEVER the titles.
function subtaskCountsByTask(taskIds) {
  if (!taskIds.length) return {};
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT task_id, COUNT(*) AS total, COALESCE(SUM(done), 0) AS done
       FROM subtasks
       WHERE task_id IN (${placeholders})
       GROUP BY task_id`,
    )
    .all(...taskIds);
  const map = {};
  for (const r of rows) map[r.task_id] = { total: r.total, done: r.done };
  return map;
}

// The complete public payload for a token, or null if the token is missing or
// revoked (the route turns null into a 404 — never a 403, so a revoked link is
// indistinguishable from one that never existed).
export function getPublicProject(token) {
  const ctx = shareContext.get(token);
  if (!ctx) return null;

  const sections = sectionsForProject.all(ctx.project_id);
  const statuses = statusesForOwner.all(ctx.owner_id);
  const tasks = tasksForProject.all(ctx.project_id);

  const taskIds = tasks.map((t) => t.id);
  const labels = labelsByTask(taskIds);
  const counts = subtaskCountsByTask(taskIds);
  for (const t of tasks) {
    t.labels = labels[t.id] ?? [];
    const c = counts[t.id];
    t.subtaskDone = c ? c.done : 0;
    t.subtaskTotal = c ? c.total : 0;
  }

  return {
    project: { name: ctx.project_name },
    sections,
    statuses,
    tasks,
  };
}
