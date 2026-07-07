import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { createTaskSchema, updateTaskSchema, reorderTasksSchema } from '../schemas/tasks.js';
import { getProjectAccess } from '../models/members.js';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  reorderTasks,
  updateTask,
} from '../models/tasks.js';
import { setTaskLabels } from '../models/labels.js';
import { sectionBelongsToProject } from '../models/sections.js';
import { defaultStatusId, getStatus, statusBelongsToUser } from '../models/statuses.js';
import { logActivity } from '../models/activities.js';

const PRIORITY_LABELS = ['none', 'low', 'medium', 'high', 'urgent'];

// Build a human summary of what a task PATCH changed. Returns { action, summary }
// or null when nothing notable changed. A status change wins the action/icon; the
// rest fold into a combined phrase so one save is one log line.
function summarizeTaskUpdate(before, after, body, userId) {
  const phrases = [];
  let statusChanged = false;
  if ('statusId' in body && after.status_id !== before.status_id) {
    statusChanged = true;
    const status = getStatus(after.status_id, userId);
    phrases.push(`status → ${status?.name ?? 'unknown'}`);
  }
  if ('title' in body && after.title !== before.title) phrases.push(`renamed to “${after.title}”`);
  if ('priority' in body && after.priority !== before.priority)
    phrases.push(`priority → ${PRIORITY_LABELS[after.priority] ?? after.priority}`);
  if ('dueDate' in body && (after.due_date ?? null) !== (before.due_date ?? null))
    phrases.push(after.due_date ? `due ${after.due_date}` : 'due date cleared');
  if ('sectionId' in body && (after.section_id ?? null) !== (before.section_id ?? null))
    phrases.push('moved section');
  if ('notes' in body && (after.notes ?? null) !== (before.notes ?? null))
    phrases.push('notes updated');

  if (!phrases.length) return null;
  return {
    action: statusChanged ? 'task.status_changed' : 'task.updated',
    summary: `“${after.title}”: ${phrases.join(', ')}`,
  };
}

// A task's sectionId must be null (ungrouped) or a section in the same project.
function assertSectionInProject(sectionId, projectId) {
  if (sectionId != null && !sectionBelongsToProject(sectionId, projectId)) {
    throw badRequest('sectionId does not belong to this project');
  }
}

// A task's statusId must be one of the user's statuses.
function assertStatusOwned(statusId, userId) {
  if (statusId != null && !statusBelongsToUser(statusId, userId)) {
    throw badRequest('statusId does not belong to you');
  }
}

// mergeParams lets this router read :projectId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Authorize the parent project once for every task route below (owner or member).
router.use((req, res, next) => {
  const access = getProjectAccess(Number(req.params.projectId), req.session.userId);
  if (!access) throw notFound('Project not found');
  req.project = access.project;
  req.role = access.role;
  next();
});

// Viewers are read-only: block every mutating verb.
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.role === 'viewer')
    throw forbidden('You have read-only access to this project');
  next();
});

router.get('/', (req, res) => {
  res.json(listTasks(req.project.id));
});

router.post('/', validateBody(createTaskSchema), (req, res) => {
  const { title, statusId, dueDate, notes, priority, labelIds, sectionId } = req.body;
  // Statuses and labels belong to the project OWNER's library, so collaborators
  // pick from and are validated against the owner's sets, not their own.
  const ownerId = req.project.user_id;
  assertSectionInProject(sectionId, req.project.id);
  assertStatusOwned(statusId, ownerId);
  const task = createTask(req.project.id, {
    title,
    statusId: statusId ?? defaultStatusId(ownerId),
    dueDate,
    notes,
    priority,
    sectionId,
  });
  if (labelIds) setTaskLabels(task.id, ownerId, labelIds);
  logActivity(req.session.userId, {
    projectId: req.project.id,
    taskId: task.id,
    action: 'task.created',
    summary: `Added task “${task.title}”`,
  });
  res.status(201).json(getTask(task.id, req.project.id));
});

// Must be declared before '/:taskId' so 'reorder' isn't parsed as a task id.
router.patch('/reorder', validateBody(reorderTasksSchema), (req, res) => {
  const tasks = reorderTasks(req.project.id, req.body.orderedIds);
  if (!tasks) throw badRequest("orderedIds must list exactly this project's task ids");
  res.json(tasks);
});

router.get('/:taskId', (req, res) => {
  const task = getTask(Number(req.params.taskId), req.project.id);
  if (!task) throw notFound('Task not found');
  res.json(task);
});

router.patch('/:taskId', validateBody(updateTaskSchema), (req, res) => {
  const ownerId = req.project.user_id;
  if ('sectionId' in req.body) assertSectionInProject(req.body.sectionId, req.project.id);
  if ('statusId' in req.body) assertStatusOwned(req.body.statusId, ownerId);
  const before = getTask(Number(req.params.taskId), req.project.id);
  const task = updateTask(Number(req.params.taskId), req.project.id, req.body);
  if (!task) throw notFound('Task not found');
  if ('labelIds' in req.body) setTaskLabels(task.id, ownerId, req.body.labelIds);
  const entry = summarizeTaskUpdate(before, task, req.body, ownerId);
  if (entry)
    logActivity(req.session.userId, { projectId: req.project.id, taskId: task.id, ...entry });
  res.json(getTask(task.id, req.project.id));
});

router.delete('/:taskId', (req, res) => {
  const before = getTask(Number(req.params.taskId), req.project.id);
  const ok = deleteTask(Number(req.params.taskId), req.project.id);
  if (!ok) throw notFound('Task not found');
  logActivity(req.session.userId, {
    projectId: req.project.id,
    taskId: null, // the row is gone; the summary keeps the title
    action: 'task.deleted',
    summary: `Deleted task “${before.title}”`,
  });
  res.status(204).end();
});

export default router;
