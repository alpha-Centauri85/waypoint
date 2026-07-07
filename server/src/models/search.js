import { db } from '../db/index.js';

// Global search across the user's own projects and tasks. Everything is scoped
// by user_id so results never leak across accounts.
const searchProjects = db.prepare(`
  SELECT id, name, description FROM projects
  WHERE user_id = ? AND (name LIKE ? ESCAPE '\\' OR IFNULL(description, '') LIKE ? ESCAPE '\\')
  ORDER BY name COLLATE NOCASE
  LIMIT 10
`);

const searchTasks = db.prepare(`
  SELECT t.id, t.title, t.status, t.due_date, t.priority, t.project_id, p.name AS project_name
  FROM tasks t
  JOIN projects p ON p.id = t.project_id
  WHERE p.user_id = ? AND (t.title LIKE ? ESCAPE '\\' OR IFNULL(t.notes, '') LIKE ? ESCAPE '\\')
  ORDER BY t.title COLLATE NOCASE
  LIMIT 25
`);

// Turn a user query into a safe LIKE pattern: escape the LIKE wildcards (% _)
// and the escape char itself so they're matched literally.
function likePattern(query) {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

export function search(userId, query) {
  const q = (query ?? '').trim();
  if (q.length < 2) return { projects: [], tasks: [] };
  const pattern = likePattern(q);
  return {
    projects: searchProjects.all(userId, pattern, pattern),
    tasks: searchTasks.all(userId, pattern, pattern),
  };
}
