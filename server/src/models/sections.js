import { db } from '../db/index.js';

// Sections group tasks within a project. Every read/write is scoped by
// project_id (the caller authorizes the project first, like tasks do).
const insert = db.prepare(
  `INSERT INTO sections (project_id, name, position)
   VALUES (?, ?, (SELECT COALESCE(MAX(position) + 1, 0) FROM sections WHERE project_id = ?))`,
);
const listByProject = db.prepare(
  'SELECT * FROM sections WHERE project_id = ? ORDER BY position, created_at',
);
const byId = db.prepare('SELECT * FROM sections WHERE id = ? AND project_id = ?');
const update = db.prepare('UPDATE sections SET name = ? WHERE id = ? AND project_id = ?');
const del = db.prepare('DELETE FROM sections WHERE id = ? AND project_id = ?');

const projectSectionIds = db.prepare('SELECT id FROM sections WHERE project_id = ?');
const setPosition = db.prepare('UPDATE sections SET position = ? WHERE id = ? AND project_id = ?');
const applyOrder = db.transaction((projectId, orderedIds) => {
  orderedIds.forEach((id, index) => setPosition.run(index, id, projectId));
});

export function createSection(projectId, { name }) {
  const { lastInsertRowid } = insert.run(projectId, name, projectId);
  return byId.get(lastInsertRowid, projectId);
}

export function listSections(projectId) {
  return listByProject.all(projectId);
}

export function updateSection(id, projectId, fields) {
  const current = byId.get(id, projectId);
  if (!current) return null;
  update.run('name' in fields ? fields.name : current.name, id, projectId);
  return byId.get(id, projectId);
}

export function deleteSection(id, projectId) {
  return del.run(id, projectId).changes > 0;
}

// Reorder all of a project's sections. `orderedIds` must be exactly the
// project's section ids (a permutation) — otherwise null so the caller rejects it.
export function reorderSections(projectId, orderedIds) {
  const existing = projectSectionIds.all(projectId).map((r) => r.id);
  const existingSet = new Set(existing);
  const isPermutation =
    orderedIds.length === existing.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => existingSet.has(id));
  if (!isPermutation) return null;
  applyOrder(projectId, orderedIds);
  return listByProject.all(projectId);
}

// Does this section belong to the given project? Used to validate a task's
// sectionId before assigning it.
export function sectionBelongsToProject(sectionId, projectId) {
  return !!byId.get(sectionId, projectId);
}
