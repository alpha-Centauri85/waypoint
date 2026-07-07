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
// Every read is scoped by user_id so users can only ever see their own rows.
const byId = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?');
const update = db.prepare(
  'UPDATE projects SET name = ?, description = ? WHERE id = ? AND user_id = ?',
);
const del = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');

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
