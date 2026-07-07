import { db } from '../db/index.js';
import { getLabelsForTask, labelsByTaskIds } from './labels.js';

// New tasks append to the end of their section (position = max + 1 within the
// same project + section); `section_id IS ?` treats NULL as the "ungrouped" group.
const insert = db.prepare(
  `INSERT INTO tasks (project_id, section_id, title, status_id, due_date, notes, priority, position)
   VALUES (?, ?, ?, ?, ?, ?, ?,
     (SELECT COALESCE(MAX(position) + 1, 0) FROM tasks WHERE project_id = ? AND section_id IS ?))`,
);
const listByProject = db.prepare(
  'SELECT * FROM tasks WHERE project_id = ? ORDER BY position, created_at',
);
const byId = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?');
const update = db.prepare(
  `UPDATE tasks SET title = ?, status_id = ?, due_date = ?, notes = ?, priority = ?, section_id = ?, position = ?
   WHERE id = ? AND project_id = ?`,
);
const del = db.prepare('DELETE FROM tasks WHERE id = ? AND project_id = ?');
// Next position at the end of a (project, section) group.
const maxPosition = db.prepare(
  'SELECT COALESCE(MAX(position) + 1, 0) AS p FROM tasks WHERE project_id = ? AND section_id IS ?',
);

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
  { title, statusId, dueDate = null, notes = null, priority = 0, sectionId = null },
) {
  const { lastInsertRowid } = insert.run(
    projectId,
    sectionId,
    title,
    statusId,
    dueDate,
    notes,
    priority,
    projectId,
    sectionId,
  );
  return byId.get(lastInsertRowid, projectId);
}

// Reorder tasks by assigning position = index. `orderedIds` may be a subset of
// the project's tasks (e.g. just one section's tasks) — positions are compared
// within a group on the client, so per-group runs of 0..n are fine. Every id
// must belong to the project and be unique, else null (nothing written).
export function reorderTasks(projectId, orderedIds) {
  const existing = new Set(projectTaskIds.all(projectId).map((r) => r.id));
  const valid =
    orderedIds.length > 0 &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => existing.has(id));
  if (!valid) return null;
  applyOrder(projectId, orderedIds);
  return withLabels(listByProject.all(projectId));
}

// Attach each task's labels. Accepts a single task or an array; a bulk query
// avoids N+1 for lists.
function withLabels(tasks) {
  if (Array.isArray(tasks)) {
    const map = labelsByTaskIds(tasks.map((t) => t.id));
    for (const t of tasks) t.labels = map[t.id] ?? [];
    return tasks;
  }
  if (tasks) tasks.labels = getLabelsForTask(tasks.id);
  return tasks;
}

export function listTasks(projectId) {
  return withLabels(listByProject.all(projectId));
}

export function getTask(id, projectId) {
  return withLabels(byId.get(id, projectId));
}

export function getTaskForUser(id, userId) {
  return ownedByUser.get(id, userId);
}

// Fetch a task by id with NO ownership check — callers MUST authorize via the
// task's project (getProjectAccess). Used by subtask/comment guards, which are
// addressed by task id alone and must allow shared-project collaborators.
const taskByIdAny = db.prepare('SELECT * FROM tasks WHERE id = ?');
export function getTaskById(id) {
  return taskByIdAny.get(id);
}

export function updateTask(id, projectId, fields) {
  const current = byId.get(id, projectId);
  if (!current) return null;
  // Presence-based merge (not `?? current`) so an explicit null clears a
  // nullable field (e.g. removing a due date), while an omitted field is left
  // untouched. Validation guarantees title/status are never null when present.
  const section_id = 'sectionId' in fields ? fields.sectionId : current.section_id;
  // Moving to a different section drops the task at the end of that section.
  const position =
    section_id === current.section_id ? current.position : maxPosition.get(projectId, section_id).p;
  const merged = {
    title: 'title' in fields ? fields.title : current.title,
    status_id: 'statusId' in fields ? fields.statusId : current.status_id,
    due_date: 'dueDate' in fields ? fields.dueDate : current.due_date,
    notes: 'notes' in fields ? fields.notes : current.notes,
    priority: 'priority' in fields ? fields.priority : current.priority,
  };
  update.run(
    merged.title,
    merged.status_id,
    merged.due_date,
    merged.notes,
    merged.priority,
    section_id,
    position,
    id,
    projectId,
  );
  return byId.get(id, projectId);
}

export function deleteTask(id, projectId) {
  return del.run(id, projectId).changes > 0;
}
