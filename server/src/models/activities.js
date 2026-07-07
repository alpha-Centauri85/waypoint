import { db } from '../db/index.js';

// The activity log: an append-only, user-scoped trail of project/task events.
// Summaries are composed by the routes (which have the human context) and stored
// verbatim. Logging must never break the mutation it describes, so logActivity
// swallows its own errors.

const insert = db.prepare(
  `INSERT INTO activities (user_id, project_id, task_id, action, summary)
   VALUES (@userId, @projectId, @taskId, @action, @summary)`,
);

// Record an event. `action` is a dotted key (e.g. 'task.created') used for the
// client icon; `summary` is the display text. projectId/taskId are optional.
export function logActivity(userId, { projectId = null, taskId = null, action, summary }) {
  try {
    insert.run({ userId, projectId, taskId, action, summary });
  } catch (err) {
    // An audit-log failure should never surface to the user's action.
    console.error('logActivity failed:', err.message);
  }
}

const SELECT = `SELECT a.id, a.project_id, a.task_id, a.action, a.summary, a.created_at,
                       u.email AS author_email
                FROM activities a JOIN users u ON u.id = a.user_id`;
const cap = (limit) => Math.min(Math.max(Number(limit) || 50, 1), 200);

// The signed-in user's own actions across all their projects (global feed).
export function listActivities(userId, { limit = 50 } = {}) {
  return db
    .prepare(`${SELECT} WHERE a.user_id = ? ORDER BY a.id DESC LIMIT ?`)
    .all(userId, cap(limit));
}

// All activity on a project (every member's actions), optionally one task. The
// CALLER must authorize project access first — this is not user-scoped so a
// shared project's whole trail is visible to its members, with author attribution.
export function listProjectActivities(projectId, { taskId, limit = 50 } = {}) {
  if (taskId != null) {
    return db
      .prepare(`${SELECT} WHERE a.project_id = ? AND a.task_id = ? ORDER BY a.id DESC LIMIT ?`)
      .all(projectId, taskId, cap(limit));
  }
  return db
    .prepare(`${SELECT} WHERE a.project_id = ? ORDER BY a.id DESC LIMIT ?`)
    .all(projectId, cap(limit));
}
