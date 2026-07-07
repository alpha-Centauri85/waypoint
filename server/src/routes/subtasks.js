import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { forbidden, notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { createSubtaskSchema, updateSubtaskSchema } from '../schemas/subtasks.js';
import { getTaskById } from '../models/tasks.js';
import { getProjectAccess } from '../models/members.js';
import { createSubtask, deleteSubtask, listSubtasks, updateSubtask } from '../models/subtasks.js';

// mergeParams lets this router read :taskId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Authorize via the task's project (owner or member). Addressed by task id alone,
// so we resolve the task, then check project access.
router.use((req, res, next) => {
  const task = getTaskById(Number(req.params.taskId));
  const access = task && getProjectAccess(task.project_id, req.session.userId);
  if (!access) throw notFound('Task not found');
  if (req.method !== 'GET' && access.role === 'viewer')
    throw forbidden('You have read-only access to this project');
  req.task = task;
  req.role = access.role;
  next();
});

router.get('/', (req, res) => {
  res.json(listSubtasks(req.task.id));
});

router.post('/', validateBody(createSubtaskSchema), (req, res) => {
  const { title } = req.body;
  res.status(201).json(createSubtask(req.task.id, { title }));
});

router.patch('/:subtaskId', validateBody(updateSubtaskSchema), (req, res) => {
  const subtask = updateSubtask(Number(req.params.subtaskId), req.task.id, req.body);
  if (!subtask) throw notFound('Subtask not found');
  res.json(subtask);
});

router.delete('/:subtaskId', (req, res) => {
  const ok = deleteSubtask(Number(req.params.subtaskId), req.task.id);
  if (!ok) throw notFound('Subtask not found');
  res.status(204).end();
});

export default router;
