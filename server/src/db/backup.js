import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './index.js';
import { config } from '../config.js';

// Write a consistent, WAL-safe snapshot of the database using better-sqlite3's
// online backup API (safe to run while the app is serving requests). Files are
// timestamped; older snapshots beyond `keep` are pruned. Returns the new path.
export async function backupDatabase({ dir = config.backupDir, keep = config.backupKeep } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  // e.g. waypoint-2026-07-06T22-30-00-123Z.db (ms resolution → unique names).
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `waypoint-${stamp}.db`);
  await db.backup(dest);
  pruneOldBackups(dir, keep);
  return dest;
}

// Keep only the `keep` most-recent snapshots (by name, which sorts by time).
function pruneOldBackups(dir, keep) {
  if (!keep || keep < 1) return;
  const snapshots = fs
    .readdirSync(dir)
    .filter((f) => /^waypoint-.*\.db$/.test(f))
    .sort()
    .reverse();
  for (const f of snapshots.slice(keep)) fs.rmSync(path.join(dir, f));
}

// CLI: `npm run db:backup --workspace server` (or `node src/db/backup.js`).
// Schedule it with cron (Linux) or Task Scheduler (Windows) — see README.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  backupDatabase()
    .then((dest) => {
      console.log(`Backup written: ${dest}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}
