-- Waypoint schema. All statements are idempotent (IF NOT EXISTS) so this file
-- can be re-applied safely on every startup.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- Named groupings of tasks within a project ("sections"). Defined before tasks
-- so tasks can reference it. See docs/labels-sections-templates.md.
CREATE TABLE IF NOT EXISTS sections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sections_project ON sections(project_id);

CREATE TABLE IF NOT EXISTS tasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Optional grouping; NULL means "ungrouped". Deleting a section ungroups its
  -- tasks rather than deleting them.
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  due_date   TEXT,
  notes      TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  priority   INTEGER NOT NULL DEFAULT 0, -- 0 none · 1 low · 2 medium · 3 high · 4 urgent
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
-- idx_tasks_section is created in db/index.js after section_id is ensured, so it
-- works on databases whose tasks table predates the column.

-- Per-user label library (reusable across all the user's projects) and the
-- many-to-many link to tasks.
CREATE TABLE IF NOT EXISTS labels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'teal',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_labels_user ON labels(user_id);

CREATE TABLE IF NOT EXISTS task_labels (
  task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_task_labels_label ON task_labels(label_id);

-- Labels also annotate projects (same shared pool; scope lives in the
-- association, not a flag on the label — see docs/labels-sections-templates.md).
CREATE TABLE IF NOT EXISTS project_labels (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label_id   INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_project_labels_label ON project_labels(label_id);

-- Reusable project blueprints. A template is an ordered set of modules; a module
-- is a reusable "section blueprint" holding task blueprints. Instantiating a
-- template builds a project with a section per module. See
-- docs/labels-sections-templates.md.
CREATE TABLE IF NOT EXISTS templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);

CREATE TABLE IF NOT EXISTS modules (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_modules_user ON modules(user_id);

CREATE TABLE IF NOT EXISTS module_tasks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  priority  INTEGER NOT NULL DEFAULT 0,
  notes     TEXT,
  position  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_module_tasks_module ON module_tasks(module_id);

CREATE TABLE IF NOT EXISTS template_modules (
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  module_id   INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (template_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_template_modules_module ON template_modules(module_id);

CREATE TABLE IF NOT EXISTS subtasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);
