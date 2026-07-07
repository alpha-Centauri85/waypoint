import { db } from '../db/index.js';

// The module library: reusable, label-tagged bundles of task blueprints (with
// subtasks). Templates v2 injects a module's tasks into a section when the
// section carries one of the module's labels. Everything is user-scoped.

const insertModule = db.prepare('INSERT INTO modules (user_id, name) VALUES (?, ?)');
const moduleById = db.prepare('SELECT * FROM modules WHERE id = ? AND user_id = ?');
const listByUser = db.prepare(
  'SELECT * FROM modules WHERE user_id = ? ORDER BY name COLLATE NOCASE',
);
const updateName = db.prepare('UPDATE modules SET name = ? WHERE id = ? AND user_id = ?');
const delModule = db.prepare('DELETE FROM modules WHERE id = ? AND user_id = ?');

const insertTask = db.prepare(
  `INSERT INTO module_tasks (module_id, title, status, priority, notes, position)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const tasksByModule = db.prepare(
  'SELECT * FROM module_tasks WHERE module_id = ? ORDER BY position',
);
const insertSubtask = db.prepare(
  'INSERT INTO module_subtasks (module_task_id, title, position) VALUES (?, ?, ?)',
);
const subtasksByTask = db.prepare(
  'SELECT title FROM module_subtasks WHERE module_task_id = ? ORDER BY position',
);

const ownedLabelIds = db.prepare('SELECT id FROM labels WHERE user_id = ?');
const insertModuleLabel = db.prepare(
  'INSERT OR IGNORE INTO module_labels (module_id, label_id) VALUES (?, ?)',
);
const clearModuleLabels = db.prepare('DELETE FROM module_labels WHERE module_id = ?');
const labelsByModule = db.prepare(`
  SELECT l.id, l.name, l.color FROM labels l
  JOIN module_labels ml ON ml.label_id = l.id
  WHERE ml.module_id = ?
  ORDER BY l.name COLLATE NOCASE
`);

// Rebuild a module's tasks (+subtasks). Must run in a transaction.
function replaceTasks(moduleId, tasks) {
  db.prepare('DELETE FROM module_tasks WHERE module_id = ?').run(moduleId); // cascades subtasks
  tasks.forEach((t, i) => {
    const taskId = insertTask.run(
      moduleId,
      t.title,
      t.status ?? 'todo',
      t.priority ?? 0,
      t.notes ?? null,
      i,
    ).lastInsertRowid;
    (t.subtasks ?? []).forEach((title, j) => insertSubtask.run(taskId, title, j));
  });
}

function setLabels(moduleId, userId, labelIds) {
  const owned = new Set(ownedLabelIds.all(userId).map((r) => r.id));
  clearModuleLabels.run(moduleId);
  for (const id of labelIds ?? []) if (owned.has(id)) insertModuleLabel.run(moduleId, id);
}

function hydrate(module) {
  module.labels = labelsByModule.all(module.id);
  module.tasks = tasksByModule.all(module.id).map((t) => ({
    title: t.title,
    status: t.status,
    priority: t.priority,
    notes: t.notes,
    subtasks: subtasksByTask.all(t.id).map((s) => s.title),
  }));
  return module;
}

export function listModules(userId) {
  return listByUser.all(userId).map((m) => ({
    id: m.id,
    name: m.name,
    labels: labelsByModule.all(m.id),
    task_count: tasksByModule.all(m.id).length,
  }));
}

export function getModule(id, userId) {
  const module = moduleById.get(id, userId);
  return module ? hydrate(module) : null;
}

export const createModule = db.transaction((userId, { name, labelIds = [], tasks = [] }) => {
  const id = insertModule.run(userId, name).lastInsertRowid;
  setLabels(id, userId, labelIds);
  replaceTasks(id, tasks);
  return hydrate(moduleById.get(id, userId));
});

// Create several empty modules at once (bulk authoring). Returns the new modules.
export const bulkCreateModules = db.transaction((userId, names) => {
  return names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => hydrate(moduleById.get(insertModule.run(userId, name).lastInsertRowid, userId)));
});

export const updateModule = db.transaction((userId, id, { name, labelIds, tasks }) => {
  const current = moduleById.get(id, userId);
  if (!current) return null;
  if (name != null) updateName.run(name, id, userId);
  if (labelIds !== undefined) setLabels(id, userId, labelIds);
  if (tasks !== undefined) replaceTasks(id, tasks);
  return hydrate(moduleById.get(id, userId));
});

export function deleteModule(id, userId) {
  return delModule.run(id, userId).changes > 0;
}

// Modules (with tasks + subtasks) carrying any of the given labels — used by
// template instantiation to inject into a labelled section.
export function modulesForLabels(userId, labelIds) {
  if (!labelIds.length) return [];
  const placeholders = labelIds.map(() => '?').join(',');
  const ids = db
    .prepare(
      `SELECT DISTINCT m.id FROM modules m
       JOIN module_labels ml ON ml.module_id = m.id
       WHERE m.user_id = ? AND ml.label_id IN (${placeholders})
       ORDER BY m.name COLLATE NOCASE`,
    )
    .all(userId, ...labelIds);
  return ids.map((r) => hydrate(moduleById.get(r.id, userId)));
}
