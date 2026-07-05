import { db } from '../db/index.js';

const insert = db.prepare('INSERT INTO projects (user_id, name, description) VALUES (?, ?, ?)');
const listByUser = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC');
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
  return listByUser.all(userId);
}

export function getProject(id, userId) {
  return byId.get(id, userId);
}

export function updateProject(id, userId, { name, description }) {
  const current = byId.get(id, userId);
  if (!current) return null;
  update.run(name ?? current.name, description ?? current.description, id, userId);
  return byId.get(id, userId);
}

export function deleteProject(id, userId) {
  return del.run(id, userId).changes > 0;
}
