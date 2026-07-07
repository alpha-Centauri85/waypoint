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

// Most-recent-first activity for the user, optionally scoped to a project or a
// single task. Always filtered by user_id so it can't leak across accounts.
export function listActivities(userId, { projectId, taskId, limit = 50 } = {}) {
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (projectId != null) {
    clauses.push('project_id = ?');
    params.push(projectId);
  }
  if (taskId != null) {
    clauses.push('task_id = ?');
    params.push(taskId);
  }
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return db
    .prepare(
      `SELECT id, project_id, task_id, action, summary, created_at
       FROM activities WHERE ${clauses.join(' AND ')} ORDER BY id DESC LIMIT ?`,
    )
    .all(...params, cap);
}
