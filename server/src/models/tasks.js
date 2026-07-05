import { db } from '../db/index.js';

const insert = db.prepare(
  'INSERT INTO tasks (project_id, title, status, due_date, notes) VALUES (?, ?, ?, ?, ?)',
);
const listByProject = db.prepare(
  'SELECT * FROM tasks WHERE project_id = ? ORDER BY position, created_at',
);
const byId = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?');
const update = db.prepare(
  'UPDATE tasks SET title = ?, status = ?, due_date = ?, notes = ? WHERE id = ? AND project_id = ?',
);
const del = db.prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?');

// Resolve a task only if it belongs to a project owned by the given user.
// Used to authorize subtask operations addressed by task id alone.
const ownedByUser = db.prepare(`
  SELECT tasks.* FROM tasks
  JOIN projects ON projects.id = tasks.project_id
  WHERE tasks.id = ? AND projects.user_id = ?
`);

export function createTask(projectId, { title, status = 'todo', dueDate = null, notes = null }) {
  const { lastInsertRowid } = insert.run(projectId, title, status, dueDate, notes);
  return byId.get(lastInsertRowid, projectId);
}

export function listTasks(projectId) {
  return listByProject.all(projectId);
}

export function getTask(id, projectId) {
  return byId.get(id, projectId);
}

export function getTaskForUser(id, userId) {
  return ownedByUser.get(id, userId);
}

export function updateTask(id, projectId, fields) {
  const current = byId.get(id, projectId);
  if (!current) return null;
  const merged = {
    title: fields.title ?? current.title,
    status: fields.status ?? current.status,
    due_date: fields.dueDate ?? current.due_date,
    notes: fields.notes ?? current.notes,
  };
  update.run(merged.title, merged.status, merged.due_date, merged.notes, id, projectId);
  return byId.get(id, projectId);
}

export function deleteTask(id, projectId) {
  return del.run(id, projectId).changes > 0;
}
