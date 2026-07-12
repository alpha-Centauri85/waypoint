import { db } from '../db/index.js';

// Per-user workflow statuses. Seeded lazily with three defaults the first time a
// user's statuses are touched; existing tasks are backfilled from the legacy
// `status` text via the default keys. Everything is user-scoped.

const DEFAULTS = [
  { key: 'todo', name: 'To do', color: 'gray', is_done: 0 },
  { key: 'doing', name: 'In progress', color: 'amber', is_done: 0 },
  { key: 'done', name: 'Done', color: 'teal', is_done: 1 },
];

const listByUser = db.prepare('SELECT * FROM statuses WHERE user_id = ? ORDER BY position');
const countByUser = db.prepare('SELECT COUNT(*) AS c FROM statuses WHERE user_id = ?');
const insert = db.prepare(
  'INSERT INTO statuses (user_id, name, color, position, is_done, key) VALUES (?, ?, ?, ?, ?, ?)',
);
const byId = db.prepare('SELECT * FROM statuses WHERE id = ? AND user_id = ?');
const update = db.prepare(
  'UPDATE statuses SET name = ?, color = ?, is_done = ? WHERE id = ? AND user_id = ?',
);
const del = db.prepare('DELETE FROM statuses WHERE id = ? AND user_id = ?');
const setPosition = db.prepare('UPDATE statuses SET position = ? WHERE id = ? AND user_id = ?');

// Tasks link to statuses only via their project's owner, so scoping is by user.
const userTasks = 'project_id IN (SELECT id FROM projects WHERE user_id = ?)';
const backfillByKey = db.prepare(
  `UPDATE tasks SET status_id = ? WHERE status = ? AND ${userTasks}`,
);
const backfillNull = db.prepare(
  `UPDATE tasks SET status_id = ? WHERE status_id IS NULL AND ${userTasks}`,
);
const reassignTasks = db.prepare(
  `UPDATE tasks SET status_id = ? WHERE status_id = ? AND ${userTasks}`,
);
// Subtasks share the task workflow, so a deleted status must also release the
// owner's subtasks (scoped via task → project → user), keeping `done` in sync
// with the fallback status's is_done. Without this they'd dangle / FK-error.
const userSubtasks = `task_id IN (
  SELECT t.id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.user_id = ?
)`;
const reassignSubtasks = db.prepare(
  `UPDATE subtasks SET status_id = ?, done = ? WHERE status_id = ? AND ${userSubtasks}`,
);

const seed = db.transaction((userId) => {
  DEFAULTS.forEach((d, i) => {
    const id = insert.run(userId, d.name, d.color, i, d.is_done, d.key).lastInsertRowid;
    backfillByKey.run(id, d.key, userId); // legacy 'todo'/'doing'/'done' → this id
  });
  const first = listByUser.all(userId)[0];
  if (first) backfillNull.run(first.id, userId); // any unmatched task → first status
});

export function ensureStatuses(userId) {
  if (countByUser.get(userId).c === 0) seed(userId);
}

export function listStatuses(userId) {
  ensureStatuses(userId);
  return listByUser.all(userId);
}

export function getStatus(id, userId) {
  return byId.get(id, userId);
}

// The status a brand-new task gets (the first in the workflow).
export function defaultStatusId(userId) {
  ensureStatuses(userId);
  return listByUser.all(userId)[0].id;
}

// Resolve a legacy status key ('todo'/'doing'/'done') to a status id for the
// user, falling back to their first status (used when instantiating templates).
export function statusIdForKey(userId, key) {
  ensureStatuses(userId);
  const all = listByUser.all(userId);
  return (all.find((s) => s.key === key) ?? all[0]).id;
}

export function createStatus(userId, { name, color = 'gray', isDone = false }) {
  ensureStatuses(userId);
  const position = listByUser.all(userId).length;
  const id = insert.run(userId, name, color, position, isDone ? 1 : 0, null).lastInsertRowid;
  return byId.get(id, userId);
}

export function updateStatus(id, userId, fields) {
  const current = byId.get(id, userId);
  if (!current) return null;
  update.run(
    'name' in fields ? fields.name : current.name,
    'color' in fields ? fields.color : current.color,
    'isDone' in fields ? (fields.isDone ? 1 : 0) : current.is_done,
    id,
    userId,
  );
  return byId.get(id, userId);
}

// Delete a status, reassigning any tasks using it to another status. Refuses to
// remove the last remaining status. Returns { ok } or { error }.
export const deleteStatus = db.transaction((id, userId) => {
  const all = listByUser.all(userId);
  if (!all.some((s) => s.id === id)) return { error: 'not_found' };
  if (all.length <= 1) return { error: 'last' };
  const fallback = all.find((s) => s.id !== id);
  reassignTasks.run(fallback.id, id, userId);
  reassignSubtasks.run(fallback.id, fallback.is_done ? 1 : 0, id, userId);
  del.run(id, userId);
  return { ok: true };
});

export function reorderStatuses(userId, orderedIds) {
  const existing = listByUser.all(userId).map((s) => s.id);
  const set = new Set(existing);
  const isPermutation =
    orderedIds.length === existing.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((sid) => set.has(sid));
  if (!isPermutation) return null;
  const apply = db.transaction(() =>
    orderedIds.forEach((sid, i) => setPosition.run(i, sid, userId)),
  );
  apply();
  return listByUser.all(userId);
}

export function statusBelongsToUser(id, userId) {
  return !!byId.get(id, userId);
}
