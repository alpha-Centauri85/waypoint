import { db } from '../db/index.js';

const insert = db.prepare('INSERT INTO subtasks (task_id, title) VALUES (?, ?)');
const listByTask = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at');
const byId = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?');
const update = db.prepare('UPDATE subtasks SET title = ?, done = ? WHERE id = ? AND task_id = ?');
const del = db.prepare('DELETE FROM subtasks WHERE id = ? AND task_id = ?');

export function createSubtask(taskId, { title }) {
  const { lastInsertRowid } = insert.run(taskId, title);
  return byId.get(lastInsertRowid, taskId);
}

export function listSubtasks(taskId) {
  return listByTask.all(taskId);
}

export function updateSubtask(id, taskId, fields) {
  const current = byId.get(id, taskId);
  if (!current) return null;
  const title = fields.title ?? current.title;
  // SQLite stores booleans as 0/1.
  const done = fields.done === undefined ? current.done : fields.done ? 1 : 0;
  update.run(title, done, id, taskId);
  return byId.get(id, taskId);
}

export function deleteSubtask(id, taskId) {
  return del.run(id, taskId).changes > 0;
}
