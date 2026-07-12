import { db } from '../db/index.js';

const insert = db.prepare(
  'INSERT INTO subtasks (task_id, title, status_id, done) VALUES (?, ?, ?, ?)',
);
const listByTask = db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at');
const byId = db.prepare('SELECT * FROM subtasks WHERE id = ? AND task_id = ?');
const update = db.prepare(
  'UPDATE subtasks SET title = ?, status_id = ?, done = ? WHERE id = ? AND task_id = ?',
);
const del = db.prepare('DELETE FROM subtasks WHERE id = ? AND task_id = ?');
const statusIsDone = db.prepare('SELECT is_done FROM statuses WHERE id = ?');

// `done` is a derived mirror of the chosen status's is_done (kept for backups /
// templates). SQLite stores booleans as 0/1.
function doneForStatus(statusId) {
  if (statusId == null) return 0;
  return statusIsDone.get(statusId)?.is_done ? 1 : 0;
}

export function createSubtask(taskId, { title, statusId = null }) {
  const { lastInsertRowid } = insert.run(taskId, title, statusId, doneForStatus(statusId));
  return byId.get(lastInsertRowid, taskId);
}

export function listSubtasks(taskId) {
  return listByTask.all(taskId);
}

export function updateSubtask(id, taskId, fields) {
  const current = byId.get(id, taskId);
  if (!current) return null;
  const title = 'title' in fields ? fields.title : current.title;
  const status_id = 'statusId' in fields ? fields.statusId : current.status_id;
  // Keep `done` in sync with the (new or existing) status; a legacy row with no
  // status_id keeps its stored `done` rather than being forced to 0.
  const done = status_id == null ? current.done : doneForStatus(status_id);
  update.run(title, status_id, done, id, taskId);
  return byId.get(id, taskId);
}

export function deleteSubtask(id, taskId) {
  return del.run(id, taskId).changes > 0;
}
