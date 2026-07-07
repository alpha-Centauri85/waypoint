import { db } from '../db/index.js';
import { createProject, getProject } from './projects.js';
import { createSection, listSections } from './sections.js';
import { createTask, listTasks } from './tasks.js';
import { createSubtask, listSubtasks } from './subtasks.js';
import { listStatuses, statusIdForKey } from './statuses.js';
import { modulesForLabels } from './modules.js';

// Templates v2: a reusable project blueprint = a fixed skeleton (ordered
// sections → fixed tasks → subtasks) plus per-section label "slots". On
// instantiation the fixed content is created, then every library module carrying
// one of a section's labels has its tasks injected there.
// See docs/labels-sections-templates.md.

const insertTemplate = db.prepare(
  'INSERT INTO templates (user_id, name, description) VALUES (?, ?, ?)',
);
const templateById = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?');
const updateTemplateRow = db.prepare(
  'UPDATE templates SET name = ?, description = ? WHERE id = ? AND user_id = ?',
);
const delTemplate = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?');

const insertSection = db.prepare(
  'INSERT INTO template_sections (template_id, name, position) VALUES (?, ?, ?)',
);
const sectionsByTemplate = db.prepare(
  'SELECT * FROM template_sections WHERE template_id = ? ORDER BY position',
);
const clearSections = db.prepare('DELETE FROM template_sections WHERE template_id = ?');
const insertSectionLabel = db.prepare(
  'INSERT OR IGNORE INTO template_section_labels (template_section_id, label_id) VALUES (?, ?)',
);
const sectionLabels = db.prepare(`
  SELECT l.id, l.name, l.color FROM labels l
  JOIN template_section_labels tsl ON tsl.label_id = l.id
  WHERE tsl.template_section_id = ?
  ORDER BY l.name COLLATE NOCASE
`);
const insertTemplateTask = db.prepare(
  `INSERT INTO template_tasks (template_section_id, title, status_key, priority, notes, position)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const tasksBySection = db.prepare(
  'SELECT * FROM template_tasks WHERE template_section_id = ? ORDER BY position',
);
const insertTemplateSubtask = db.prepare(
  'INSERT INTO template_subtasks (template_task_id, title, position) VALUES (?, ?, ?)',
);
const subtasksByTask = db.prepare(
  'SELECT title FROM template_subtasks WHERE template_task_id = ? ORDER BY position',
);
const ownedLabelIds = db.prepare('SELECT id FROM labels WHERE user_id = ?');

const COUNTS = `
    (SELECT COUNT(*) FROM template_sections ts WHERE ts.template_id = t.id) AS section_count,
    (SELECT COUNT(*) FROM template_sections ts
       JOIN template_tasks tt ON tt.template_section_id = ts.id
       WHERE ts.template_id = t.id) AS task_count`;
const listWithCounts = db.prepare(
  `SELECT t.*, ${COUNTS} FROM templates t WHERE t.user_id = ? ORDER BY t.created_at DESC`,
);
const oneWithCounts = db.prepare(
  `SELECT t.*, ${COUNTS} FROM templates t WHERE t.id = ? AND t.user_id = ?`,
);

export function listTemplates(userId) {
  return listWithCounts.all(userId);
}

export function getTemplate(id, userId) {
  const template = templateById.get(id, userId);
  if (!template) return null;
  template.sections = sectionsByTemplate.all(id).map((s) => ({
    id: s.id,
    name: s.name,
    labels: sectionLabels.all(s.id),
    labelIds: sectionLabels.all(s.id).map((l) => l.id),
    tasks: tasksBySection.all(s.id).map((t) => ({
      title: t.title,
      status: t.status_key,
      priority: t.priority,
      notes: t.notes,
      subtasks: subtasksByTask.all(t.id).map((st) => st.title),
    })),
  }));
  return template;
}

export function deleteTemplate(id, userId) {
  return delTemplate.run(id, userId).changes > 0;
}

// Rebuild a template's whole section/task/subtask/label structure. In a transaction.
function replaceSections(templateId, userId, sections) {
  const owned = new Set(ownedLabelIds.all(userId).map((r) => r.id));
  clearSections.run(templateId); // cascades tasks, subtasks, section labels
  sections.forEach((s, i) => {
    const sectionId = insertSection.run(templateId, s.name, i).lastInsertRowid;
    for (const labelId of s.labelIds ?? []) {
      if (owned.has(labelId)) insertSectionLabel.run(sectionId, labelId);
    }
    (s.tasks ?? []).forEach((t, j) => {
      const taskId = insertTemplateTask.run(
        sectionId,
        t.title,
        t.status ?? 'todo',
        t.priority ?? 0,
        t.notes ?? null,
        j,
      ).lastInsertRowid;
      (t.subtasks ?? []).forEach((title, k) => insertTemplateSubtask.run(taskId, title, k));
    });
  });
}

export const createTemplate = db.transaction(
  (userId, { name, description = null, sections = [] }) => {
    const id = insertTemplate.run(userId, name, description).lastInsertRowid;
    replaceSections(id, userId, sections);
    return oneWithCounts.get(id, userId);
  },
);

export const updateTemplate = db.transaction(
  (userId, id, { name, description = null, sections = [] }) => {
    if (!templateById.get(id, userId)) return null;
    updateTemplateRow.run(name, description, id, userId);
    replaceSections(id, userId, sections);
    return oneWithCounts.get(id, userId);
  },
);

// Capture a project as a template: real sections + ungrouped → template sections,
// tasks (+subtasks) → template tasks. Status is stored as a key. Section labels
// aren't captured (projects don't label sections) — add slots in the editor.
export const createTemplateFromProject = db.transaction((userId, projectId, name) => {
  const project = getProject(projectId, userId);
  if (!project) return null;

  const keyByStatusId = new Map(listStatuses(userId).map((s) => [s.id, s.key]));
  const allTasks = listTasks(projectId);
  const asTask = (t) => ({
    title: t.title,
    status: keyByStatusId.get(t.status_id) ?? 'todo',
    priority: t.priority,
    notes: t.notes,
    subtasks: listSubtasks(t.id).map((st) => st.title),
  });

  const sections = listSections(projectId).map((s) => ({
    name: s.name,
    labelIds: [],
    tasks: allTasks.filter((t) => t.section_id === s.id).map(asTask),
  }));
  const ungrouped = allTasks.filter((t) => (t.section_id ?? null) === null);
  if (ungrouped.length)
    sections.push({ name: 'General', labelIds: [], tasks: ungrouped.map(asTask) });

  return createTemplate(userId, { name, description: project.description ?? null, sections });
});

// Build a new project: fixed sections + tasks (+subtasks), then inject the tasks
// of every library module carrying one of each section's labels.
export const instantiateTemplate = db.transaction((userId, templateId, name) => {
  const template = getTemplate(templateId, userId);
  if (!template) return null;

  const project = createProject(userId, { name, description: template.description ?? null });
  const addTask = (sectionId, t) => {
    const task = createTask(project.id, {
      title: t.title,
      statusId: statusIdForKey(userId, t.status),
      priority: t.priority ?? 0,
      notes: t.notes ?? null,
      sectionId,
    });
    for (const title of t.subtasks ?? []) createSubtask(task.id, { title });
  };

  for (const section of template.sections) {
    const created = createSection(project.id, { name: section.name });
    for (const t of section.tasks) addTask(created.id, t);
    // Inject modules whose labels match this section's slots.
    for (const module of modulesForLabels(userId, section.labelIds)) {
      for (const t of module.tasks) addTask(created.id, t);
    }
  }
  return project;
});
