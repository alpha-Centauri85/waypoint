import { db } from '../db/index.js';

// Per-user label library, plus the task <-> label link. Ownership is always
// scoped by user_id so a user can only ever see/attach their own labels.
const insert = db.prepare('INSERT INTO labels (user_id, name, color) VALUES (?, ?, ?)');
const listByUser = db.prepare(
  'SELECT * FROM labels WHERE user_id = ? ORDER BY name COLLATE NOCASE',
);
const byId = db.prepare('SELECT * FROM labels WHERE id = ? AND user_id = ?');
const update = db.prepare('UPDATE labels SET name = ?, color = ? WHERE id = ? AND user_id = ?');
const del = db.prepare('DELETE FROM labels WHERE id = ? AND user_id = ?');

const ownedIds = db.prepare('SELECT id FROM labels WHERE user_id = ?');
const attach = db.prepare('INSERT OR IGNORE INTO task_labels (task_id, label_id) VALUES (?, ?)');
const detachAll = db.prepare('DELETE FROM task_labels WHERE task_id = ?');
const forTask = db.prepare(`
  SELECT l.id, l.name, l.color FROM labels l
  JOIN task_labels tl ON tl.label_id = l.id
  WHERE tl.task_id = ?
  ORDER BY l.name COLLATE NOCASE
`);

const attachProject = db.prepare(
  'INSERT OR IGNORE INTO project_labels (project_id, label_id) VALUES (?, ?)',
);
const detachAllProject = db.prepare('DELETE FROM project_labels WHERE project_id = ?');
const forProject = db.prepare(`
  SELECT l.id, l.name, l.color FROM labels l
  JOIN project_labels pl ON pl.label_id = l.id
  WHERE pl.project_id = ?
  ORDER BY l.name COLLATE NOCASE
`);

export function listLabels(userId) {
  return listByUser.all(userId);
}

export function getLabel(id, userId) {
  return byId.get(id, userId);
}

export function createLabel(userId, { name, color = 'teal' }) {
  const { lastInsertRowid } = insert.run(userId, name, color);
  return byId.get(lastInsertRowid, userId);
}

export function updateLabel(id, userId, fields) {
  const current = byId.get(id, userId);
  if (!current) return null;
  const name = 'name' in fields ? fields.name : current.name;
  const color = 'color' in fields ? fields.color : current.color;
  update.run(name, color, id, userId);
  return byId.get(id, userId);
}

export function deleteLabel(id, userId) {
  return del.run(id, userId).changes > 0;
}

// Labels attached to one task.
export function getLabelsForTask(taskId) {
  return forTask.all(taskId);
}

// Labels for many tasks at once, grouped by task id (avoids N+1 in list views).
export function labelsByTaskIds(taskIds) {
  if (!taskIds.length) return {};
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT tl.task_id, l.id, l.name, l.color FROM labels l
       JOIN task_labels tl ON tl.label_id = l.id
       WHERE tl.task_id IN (${placeholders})
       ORDER BY l.name COLLATE NOCASE`,
    )
    .all(...taskIds);
  const map = {};
  for (const { task_id, ...label } of rows) (map[task_id] ??= []).push(label);
  return map;
}

// Replace a task's labels with `labelIds`, ignoring any id the user doesn't own.
export const setTaskLabels = db.transaction((taskId, userId, labelIds) => {
  const owned = new Set(ownedIds.all(userId).map((r) => r.id));
  detachAll.run(taskId);
  for (const id of labelIds) if (owned.has(id)) attach.run(taskId, id);
});

// Same, for projects. Labels come from the one shared pool (see design note).
export function getLabelsForProject(projectId) {
  return forProject.all(projectId);
}

export function labelsByProjectIds(projectIds) {
  if (!projectIds.length) return {};
  const placeholders = projectIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT pl.project_id, l.id, l.name, l.color FROM labels l
       JOIN project_labels pl ON pl.label_id = l.id
       WHERE pl.project_id IN (${placeholders})
       ORDER BY l.name COLLATE NOCASE`,
    )
    .all(...projectIds);
  const map = {};
  for (const { project_id, ...label } of rows) (map[project_id] ??= []).push(label);
  return map;
}

export const setProjectLabels = db.transaction((projectId, userId, labelIds) => {
  const owned = new Set(ownedIds.all(userId).map((r) => r.id));
  detachAllProject.run(projectId);
  for (const id of labelIds) if (owned.has(id)) attachProject.run(projectId, id);
});
