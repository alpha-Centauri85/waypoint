import { db } from '../db/index.js';

// Comments on a task (a thread). Authored by a user; edits stamp updated_at.
// Responses embed author_email so a shared project (roadmap 19) can attribute
// them; today the author is always the task owner.

const insert = db.prepare('INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)');
const oneById = db.prepare(`
  SELECT c.id, c.task_id, c.user_id, c.body, c.created_at, c.updated_at, u.email AS author_email
  FROM comments c JOIN users u ON u.id = c.user_id
  WHERE c.id = ? AND c.task_id = ?
`);
const listByTask = db.prepare(`
  SELECT c.id, c.task_id, c.user_id, c.body, c.created_at, c.updated_at, u.email AS author_email
  FROM comments c JOIN users u ON u.id = c.user_id
  WHERE c.task_id = ? ORDER BY c.id
`);
// Edits/deletes are author-scoped (user_id) so only the writer can change them.
const updateBody = db.prepare(
  "UPDATE comments SET body = ?, updated_at = datetime('now') WHERE id = ? AND task_id = ? AND user_id = ?",
);
const del = db.prepare('DELETE FROM comments WHERE id = ? AND task_id = ? AND user_id = ?');

export function createComment(taskId, userId, { body }) {
  const { lastInsertRowid } = insert.run(taskId, userId, body);
  return oneById.get(lastInsertRowid, taskId);
}

export function listComments(taskId) {
  return listByTask.all(taskId);
}

export function updateComment(id, taskId, userId, { body }) {
  if (updateBody.run(body, id, taskId, userId).changes === 0) return null;
  return oneById.get(id, taskId);
}

export function deleteComment(id, taskId, userId) {
  return del.run(id, taskId, userId).changes > 0;
}
