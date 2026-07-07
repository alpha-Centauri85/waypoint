import { db } from '../db/index.js';
import { getLabelsForProject, labelsByProjectIds } from './labels.js';

const insert = db.prepare('INSERT INTO projects (user_id, name, description) VALUES (?, ?, ?)');
// Include task rollups (total + done) so the UI can show per-project progress
// without an extra request per project.
const listByUser = db.prepare(`
  SELECT p.*,
    COUNT(t.id) AS task_count,
    COALESCE(SUM(CASE WHEN st.is_done = 1 THEN 1 ELSE 0 END), 0) AS done_count
  FROM projects p
  LEFT JOIN tasks t ON t.project_id = p.id
  LEFT JOIN statuses st ON st.id = t.status_id
  WHERE p.user_id = ?
  GROUP BY p.id
  ORDER BY p.created_at DESC
`);
// Owner-scoped read (only the creator's own row).
const byId = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?');
// Unscoped read by id — callers MUST authorize access first (see members.js).
const byIdAny = db.prepare('SELECT * FROM projects WHERE id = ?');
const update = db.prepare(
  'UPDATE projects SET name = ?, description = ? WHERE id = ? AND user_id = ?',
);
const del = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');

// Owned + shared, with the viewer's role, the owner's email, and task rollups.
const listForUser = db.prepare(`
  SELECT p.*,
    CASE WHEN p.user_id = @uid THEN 'owner' ELSE pm.role END AS role,
    owner.email AS owner_email,
    COUNT(t.id) AS task_count,
    COALESCE(SUM(CASE WHEN st.is_done = 1 THEN 1 ELSE 0 END), 0) AS done_count
  FROM projects p
  JOIN users owner ON owner.id = p.user_id
  LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = @uid
  LEFT JOIN tasks t ON t.project_id = p.id
  LEFT JOIN statuses st ON st.id = t.status_id
  WHERE p.user_id = @uid OR pm.user_id = @uid
  GROUP BY p.id
  ORDER BY (p.user_id = @uid) DESC, p.created_at DESC
`);

export function createProject(userId, { name, description = null }) {
  const { lastInsertRowid } = insert.run(userId, name, description);
  return byId.get(lastInsertRowid, userId);
}

export function listProjects(userId) {
  const rows = listByUser.all(userId);
  const map = labelsByProjectIds(rows.map((p) => p.id));
  for (const p of rows) p.labels = map[p.id] ?? [];
  return rows;
}

export function getProject(id, userId) {
  const project = byId.get(id, userId);
  if (project) project.labels = getLabelsForProject(project.id);
  return project;
}

// Owned + shared projects for the sidebar (each carries `role` + `owner_email`).
export function listProjectsForUser(userId) {
  const rows = listForUser.all({ uid: userId });
  const map = labelsByProjectIds(rows.map((p) => p.id));
  for (const p of rows) p.labels = map[p.id] ?? [];
  return rows;
}

// Fetch a project by id with NO ownership check. Only call after authorizing the
// user via members.js (getProjectAccess). Hydrates labels like getProject.
export function getProjectById(id) {
  const project = byIdAny.get(id);
  if (project) project.labels = getLabelsForProject(project.id);
  return project;
}

export function updateProject(id, userId, fields) {
  const current = byId.get(id, userId);
  if (!current) return null;
  // Presence-based merge so an explicit null clears the description; an omitted
  // field is left untouched. Validation guarantees name is non-null when present.
  const name = 'name' in fields ? fields.name : current.name;
  const description = 'description' in fields ? fields.description : current.description;
  update.run(name, description, id, userId);
  return byId.get(id, userId);
}

export function deleteProject(id, userId) {
  return del.run(id, userId).changes > 0;
}
