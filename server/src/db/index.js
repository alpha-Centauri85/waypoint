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
