import { db } from '../db/index.js';

// In-app due-date reminders. A periodic sweep (runReminders) finds each user's
// not-done tasks that are due today or overdue in any project they can access
// (owned or shared) and inserts one notification per task per due date. A UNIQUE
// index makes re-runs idempotent (INSERT OR IGNORE), so the sweep can run on a
// timer without spamming. Delivery is in-app (a header bell); email can layer on
// later as a second channel over the same rows.

// The server's own calendar day as 'YYYY-MM-DD', so "due today" matches the
// user's local date rather than UTC. due_date is stored as a 'YYYY-MM-DD' string,
// so a plain string comparison orders it correctly.
function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// One notification per (user, task, type, due_date) — the dedupe key. Overdue and
// due-today share the single 'task.due' type, so a task yields exactly one
// reminder for a given due date; rescheduling it (a new due_date) can remind
// again. A task with no status (status_id NULL) counts as not done.
const sweep = db.prepare(`
  INSERT OR IGNORE INTO notifications (user_id, task_id, project_id, type, due_date, message)
  SELECT accessor.user_id, t.id, t.project_id, 'task.due', t.due_date,
         CASE WHEN t.due_date < @today
              THEN 'Overdue: ' || t.title
              ELSE 'Due today: ' || t.title END
  FROM tasks t
  JOIN (
    SELECT id AS project_id, user_id FROM projects
    UNION
    SELECT project_id, user_id FROM project_members
  ) accessor ON accessor.project_id = t.project_id
  LEFT JOIN statuses st ON st.id = t.status_id
  WHERE t.due_date IS NOT NULL
    AND t.due_date <= @today
    AND COALESCE(st.is_done, 0) = 0
`);

// Run the reminder sweep. Returns the number of new notifications created.
export function runReminders({ today = localToday() } = {}) {
  return sweep.run({ today }).changes;
}

const listStmt = db.prepare(`
  SELECT n.id, n.task_id, n.project_id, n.type, n.message, n.due_date, n.read_at, n.created_at,
         p.name AS project_name, t.title AS task_title
  FROM notifications n
  LEFT JOIN projects p ON p.id = n.project_id
  LEFT JOIN tasks t ON t.id = n.task_id
  WHERE n.user_id = ?
  ORDER BY n.id DESC
  LIMIT ?
`);
const unreadStmt = db.prepare(
  'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL',
);
// COALESCE keeps an existing read_at (idempotent re-marks) while `changes > 0`
// still means "this notification exists and belongs to the user" (else a 404).
const markReadStmt = db.prepare(
  "UPDATE notifications SET read_at = COALESCE(read_at, datetime('now')) WHERE id = ? AND user_id = ?",
);
const markAllStmt = db.prepare(
  "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL",
);
const cap = (limit) => Math.min(Math.max(Number(limit) || 50, 1), 200);

export function listNotifications(userId, { limit = 50 } = {}) {
  return listStmt.all(userId, cap(limit));
}

export function unreadCount(userId) {
  return unreadStmt.get(userId).c;
}

export function markRead(id, userId) {
  return markReadStmt.run(id, userId).changes > 0;
}

export function markAllRead(userId) {
  return markAllStmt.run(userId).changes;
}
