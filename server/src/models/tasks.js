import { db } from '../db/index.js';

// New tasks append to the end of the project (position = current max + 1) so
// manual ordering stays sensible; the first task in a project gets position 0.
const insert = db.prepare(
  `INSERT INTO tasks (project_id, title, status, due_date, notes, priority, position)
   VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM tasks WHERE project_id = ?))`,
);
const listByProject = db.prepare(
  'SELECT * FROM tasks WHERE project_id = ? ORDER BY position, created_at',
);
const byId = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?');
const update = db.prepare(
  `UPDATE tasks SET title = ?, status = ?, due_date = ?, notes = ?, priority = ?
   WHERE id = ? AND project_id = ?`,
);
const del = db.prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?');

const projectTaskIds = db.prepare('SELECT id FROM tasks WHERE project_id = ?');
const setPosition = db.prepare('UPDATE tasks SET position = ? WHERE id = ? AND project_id = ?');
// Rewrite positions to match the given order, in a single transaction.
const applyOrder = db.transaction((projectId, orderedIds) => {
  orderedIds.forEach((id, index) => setPosition.run(index, id, projectId));
});

// Resolve a task only if it belongs to a project owned by the given user.
// Used to authorize subtask operations addressed by task id alone.
const ownedByUser = db.prepare(`
  SELECT tasks.* FROM tasks
  JOIN projects ON projects.id = tasks.project_id
  WHERE tasks.id = ? AND projects.user_id = ?
`);

export function createTask(
  projectId,
  { title, status = 'todo', dueDate = null, notes = null, priority = 0 },
) {
  const { lastInsertRowid } = insert.run(
    projectId,
    title,
    status,
    dueDate,
    notes,
    priority,
    projectId,
  );
  return byId.get(lastInsertRowid, projectId);
}

// Reorder a project's tasks. `orderedIds` must be exactly the project's task ids
// (a permutation) — otherwise returns null so the caller can reject the request
// rather than leave positions half-written. Returns the reordered task list.
export function reorderTasks(projectId, orderedIds) {
  const existing = projectTaskIds.all(projectId).map((r) => r.id);
  const existingSet = new Set(existing);
  const isPermutation =
    orderedIds.length === existing.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => existingSet.has(id));
  if (!isPermutation) return null;
  applyOrder(projectId, orderedIds);
  return listByProject.all(projectId);
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
  // Presence-based merge (not `?? current`) so an explicit null clears a
  // nullable field (e.g. removing a due date), while an omitted field is left
  // untouched. Validation guarantees title/status are never null when present.
  const merged = {
    title: 'title' in fields ? fields.title : current.title,
    status: 'status' in fields ? fields.status : current.status,
    due_date: 'dueDate' in fields ? fields.dueDate : current.due_date,
    notes: 'notes' in fields ? fields.notes : current.notes,
    priority: 'priority' in fields ? fields.priority : current.priority,
  };
  update.run(
    merged.title,
    merged.status,
    merged.due_date,
    merged.notes,
    merged.priority,
    id,
    projectId,
  );
  return byId.get(id, projectId);
}

export function deleteTask(id, projectId) {
  return del.run(id, projectId).changes > 0;
}
