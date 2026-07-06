import { afterEach, beforeEach, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { backupDatabase } from '../src/db/backup.js';
import { db } from '../src/db/index.js';

let dir;

beforeEach(() => {
  db.exec('DELETE FROM subtasks; DELETE FROM tasks; DELETE FROM projects; DELETE FROM users;');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wp-backup-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

test('writes a restorable snapshot of the database', async () => {
  db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run('b@x.com', 'hash');

  const dest = await backupDatabase({ dir, keep: 14 });
  expect(fs.existsSync(dest)).toBe(true);

  // The snapshot is a valid SQLite DB and contains the row.
  const snap = new Database(dest, { readonly: true });
  const rows = snap.prepare('SELECT email FROM users').all();
  snap.close();
  expect(rows).toEqual([{ email: 'b@x.com' }]);
});

test('prunes snapshots beyond the keep limit (newest kept)', async () => {
  for (let i = 0; i < 4; i++) {
    await backupDatabase({ dir, keep: 2 });
    await delay(5); // distinct millisecond-resolution filenames
  }
  const files = fs.readdirSync(dir).filter((f) => /^waypoint-.*\.db$/.test(f));
  expect(files).toHaveLength(2);
});
