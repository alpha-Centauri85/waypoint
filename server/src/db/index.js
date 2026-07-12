import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// Ensure the data directory exists for file-based databases.
if (config.dbPath !== ':memory:') {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL'); // better read/write concurrency
db.pragma('foreign_keys = ON'); // enforce ON DELETE CASCADE (per-connection)

// Apply the schema on open so tables exist before any model prepares its
// statements at import time. Idempotent — safe to run on every startup.
const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
db.exec(schema);

// Lightweight, idempotent column additions for tables that predate them, so an
// existing waypoint.db is upgraded in place on startup. (A fuller versioned
// migration system is on the roadmap; this covers additive column changes.)
function ensureColumn(table, column, definition) {
  const exists = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
ensureColumn('tasks', 'priority', 'INTEGER NOT NULL DEFAULT 0');
// section_id is added after `sections` is created by the schema above, so the
// referenced table exists when the column is added to an older tasks table.
ensureColumn('tasks', 'section_id', 'INTEGER REFERENCES sections(id) ON DELETE SET NULL');
// Custom-status FK. Backfilled from the legacy `status` text by models/statuses.js
// when a user's default statuses are seeded.
ensureColumn('tasks', 'status_id', 'INTEGER REFERENCES statuses(id)');
// Subtask custom-status FK. Mirrors tasks.status_id (no ON DELETE clause —
// deleteStatus reassigns subtasks to a fallback, so they never dangle). The
// legacy `done` column is kept and derived from the chosen status's is_done.
ensureColumn('subtasks', 'status_id', 'INTEGER REFERENCES statuses(id)');
// Indexes created here (not in schema.sql) so they run after the columns exist.
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_subtasks_status ON subtasks(status_id)');

// Backfill existing subtasks' status_id from their derived `done`, scoped to the
// project OWNER's status set (statuses are per-user). done=1 → the owner's first
// is_done status; done=0 → the owner's first status by workflow position. Only
// NULL rows are touched, so it's idempotent and a no-op once every subtask has a
// status. A subtask exists only under a task whose owner's statuses were seeded
// when the task got its status_id, so the owner's set is present; if an owner
// somehow has none yet the subquery yields NULL and the row is left as-is.
db.prepare(
  `UPDATE subtasks SET status_id = (
     SELECT s.id FROM statuses s
     JOIN tasks t ON t.id = subtasks.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE s.user_id = p.user_id AND s.is_done = 1
     ORDER BY s.position LIMIT 1)
   WHERE status_id IS NULL AND done = 1`,
).run();
db.prepare(
  `UPDATE subtasks SET status_id = (
     SELECT s.id FROM statuses s
     JOIN tasks t ON t.id = subtasks.task_id
     JOIN projects p ON p.id = t.project_id
     WHERE s.user_id = p.user_id
     ORDER BY s.position LIMIT 1)
   WHERE status_id IS NULL AND done = 0`,
).run();

// One-time migration of v1 templates (module = section via template_modules) to
// v2 (template_sections + template_tasks). Idempotent: it consumes and clears
// template_modules + the v1 module rows, so the module library starts empty.
const v1Links = db.prepare('SELECT COUNT(*) AS c FROM template_modules').get().c;
if (v1Links > 0) {
  const insSection = db.prepare(
    'INSERT INTO template_sections (template_id, name, position) VALUES (?, ?, ?)',
  );
  const insTask = db.prepare(
    `INSERT INTO template_tasks (template_section_id, title, status_key, priority, notes, position)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const modTasks = db.prepare(
    'SELECT title, status, priority, notes FROM module_tasks WHERE module_id = ? ORDER BY position',
  );
  const links = db
    .prepare(
      `SELECT tm.template_id, tm.module_id, tm.position, m.name
       FROM template_modules tm JOIN modules m ON m.id = tm.module_id
       ORDER BY tm.template_id, tm.position`,
    )
    .all();
  db.transaction(() => {
    for (const l of links) {
      const sectionId = insSection.run(l.template_id, l.name, l.position).lastInsertRowid;
      modTasks
        .all(l.module_id)
        .forEach((t, i) => insTask.run(sectionId, t.title, t.status, t.priority, t.notes, i));
    }
    db.exec(
      'DELETE FROM template_modules; DELETE FROM module_subtasks; DELETE FROM module_tasks; DELETE FROM module_labels; DELETE FROM modules;',
    );
  })();
}
