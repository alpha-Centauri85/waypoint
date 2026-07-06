import { db } from '../db/index.js';
import { createProject, getProject } from './projects.js';
import { createSection, listSections } from './sections.js';
import { createTask, listTasks } from './tasks.js';

// Templates are reusable project blueprints. A template owns an ordered set of
// modules (reusable "section blueprints"); each module owns ordered task
// blueprints. Everything is user-scoped. See docs/labels-sections-templates.md.

const insertTemplate = db.prepare(
  'INSERT INTO templates (user_id, name, description) VALUES (?, ?, ?)',
);
const templateById = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?');
const delTemplate = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?');
const insertModule = db.prepare('INSERT INTO modules (user_id, name) VALUES (?, ?)');
const insertModuleTask = db.prepare(
  `INSERT INTO module_tasks (module_id, title, status, priority, notes, position)
   VALUES (?, ?, ?, ?, ?, ?)`,
);
const linkModule = db.prepare(
  'INSERT INTO template_modules (template_id, module_id, position) VALUES (?, ?, ?)',
);

// A template with its ordered modules and each module's ordered tasks.
const modulesForTemplate = db.prepare(`
  SELECT m.id, m.name, tm.position
  FROM modules m
  JOIN template_modules tm ON tm.module_id = m.id
  WHERE tm.template_id = ?
  ORDER BY tm.position
`);
const tasksForModule = db.prepare(
  'SELECT title, status, priority, notes FROM module_tasks WHERE module_id = ? ORDER BY position',
);

// Rollup counts for the picker (module + task totals per template).
const COUNTS = `
    (SELECT COUNT(*) FROM template_modules tm WHERE tm.template_id = t.id) AS module_count,
    (SELECT COUNT(*) FROM template_modules tm
       JOIN module_tasks mt ON mt.module_id = tm.module_id
       WHERE tm.template_id = t.id) AS task_count`;
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
  template.modules = modulesForTemplate.all(id).map((m) => ({
    id: m.id,
    name: m.name,
    tasks: tasksForModule.all(m.id),
  }));
  return template;
}

export function deleteTemplate(id, userId) {
  return delTemplate.run(id, userId).changes > 0;
}

// Capture an existing project as a template: each section becomes a module, and
// ungrouped tasks (if any) become a trailing "General" module. Returns the new
// template (with counts). Transactional so a partial template is never left.
export const createTemplateFromProject = db.transaction((userId, projectId, name) => {
  const project = getProject(projectId, userId);
  if (!project) return null;

  const templateId = insertTemplate.run(userId, name, project.description ?? null).lastInsertRowid;
  const sections = listSections(projectId);
  const allTasks = listTasks(projectId);

  let modulePos = 0;
  const addModule = (moduleName, tasks) => {
    const moduleId = insertModule.run(userId, moduleName).lastInsertRowid;
    linkModule.run(templateId, moduleId, modulePos++);
    tasks.forEach((t, i) =>
      insertModuleTask.run(moduleId, t.title, t.status, t.priority ?? 0, t.notes ?? null, i),
    );
  };

  for (const section of sections) {
    addModule(
      section.name,
      allTasks.filter((t) => t.section_id === section.id),
    );
  }
  const ungrouped = allTasks.filter((t) => (t.section_id ?? null) === null);
  if (ungrouped.length) addModule('General', ungrouped);

  return oneWithCounts.get(templateId, userId);
});

// Build a new project from a template: a section per module, tasks copied in.
// Returns the created project. Transactional.
export const instantiateTemplate = db.transaction((userId, templateId, name) => {
  const template = getTemplate(templateId, userId);
  if (!template) return null;

  const project = createProject(userId, { name, description: template.description ?? null });
  for (const module of template.modules) {
    const section = createSection(project.id, { name: module.name });
    for (const t of module.tasks) {
      createTask(project.id, {
        title: t.title,
        status: t.status,
        priority: t.priority,
        notes: t.notes,
        sectionId: section.id,
      });
    }
  }
  return project;
});
