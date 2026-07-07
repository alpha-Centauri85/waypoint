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

-- Per-user workflow statuses (custom states). Seeded with To do / In progress /
-- Done on first use; `is_done` drives progress + overdue. `key` is set only on
-- the seeded defaults so legacy tasks.status text can be backfilled to status_id.
CREATE TABLE IF NOT EXISTS statuses (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  color    TEXT NOT NULL DEFAULT 'gray',
  position INTEGER NOT NULL DEFAULT 0,
  is_done  INTEGER NOT NULL DEFAULT 0,
  key      TEXT
);
CREATE INDEX IF NOT EXISTS idx_statuses_user ON statuses(user_id);

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

-- === Templates v2 (see docs/labels-sections-templates.md) ===
-- Module library: reusable, label-tagged task bundles (module_tasks reused).
-- A template section flagged with a label pulls in every module carrying it.
CREATE TABLE IF NOT EXISTS module_labels (
  module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  label_id  INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (module_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_module_labels_label ON module_labels(label_id);

CREATE TABLE IF NOT EXISTS module_subtasks (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  module_task_id INTEGER NOT NULL REFERENCES module_tasks(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_module_subtasks_task ON module_subtasks(module_task_id);

-- A template's fixed skeleton: ordered sections → fixed tasks → subtasks.
CREATE TABLE IF NOT EXISTS template_sections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_sections_template ON template_sections(template_id);

-- Labels that flag a section as an injection slot for matching modules.
CREATE TABLE IF NOT EXISTS template_section_labels (
  template_section_id INTEGER NOT NULL REFERENCES template_sections(id) ON DELETE CASCADE,
  label_id            INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (template_section_id, label_id)
);

CREATE TABLE IF NOT EXISTS template_tasks (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  template_section_id INTEGER NOT NULL REFERENCES template_sections(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  status_key          TEXT, -- todo/doing/done, mapped to the user's statuses on instantiate
  priority            INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  position            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_tasks_section ON template_tasks(template_section_id);

CREATE TABLE IF NOT EXISTS template_subtasks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  template_task_id INTEGER NOT NULL REFERENCES template_tasks(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  position         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_template_subtasks_task ON template_subtasks(template_task_id);

CREATE TABLE IF NOT EXISTS subtasks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- Activity log: an append-only trail of what happened in a project (task/project
-- created, status changed, etc.). Summaries are built at write time and stored
-- verbatim (an audit record, not a live view). project_id cascades (the trail
-- dies with its project); task_id is nulled if the task is later deleted so the
-- "deleted task X" record survives. See docs and routes/{projects,tasks}.js.
CREATE TABLE IF NOT EXISTS activities (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  summary    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id, id);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id, id);
