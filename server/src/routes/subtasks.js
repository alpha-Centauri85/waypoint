import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { getTaskForUser } from '../models/tasks.js';
import {
  createSubtask,
  deleteSubtask,
  listSubtasks,
  updateSubtask,
} from '../models/subtasks.js';

// mergeParams lets this router read :taskId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Authorize the parent task (must belong to a project owned by the user).
router.use((req, res, next) => {
  const task = getTaskForUser(Number(req.params.taskId), req.session.userId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  req.task = task;
  next();
});

router.get('/', (req, res) => {
  res.json(listSubtasks(req.task.id));
});

router.post('/', (req, res) => {
  const { title } = req.body ?? {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  res.status(201).json(createSubtask(req.task.id, { title }));
});

router.patch('/:subtaskId', (req, res) => {
  const subtask = updateSubtask(Number(req.params.subtaskId), req.task.id, req.body ?? {});
  if (!subtask) return res.status(404).json({ error: 'Subtask not found' });
  res.json(subtask);
});

router.delete('/:subtaskId', (req, res) => {
  const ok = deleteSubtask(Number(req.params.subtaskId), req.task.id);
  if (!ok) return res.status(404).json({ error: 'Subtask not found' });
  res.status(204).end();
});

export default router;
