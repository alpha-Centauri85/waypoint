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
// Indexes created here (not in schema.sql) so they run after the columns exist.
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id)');
db.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status_id)');
