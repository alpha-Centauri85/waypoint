import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { getProject } from '../models/projects.js';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../models/tasks.js';

// mergeParams lets this router read :projectId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Authorize the parent project once for every task route below.
router.use((req, res, next) => {
  const project = getProject(Number(req.params.projectId), req.session.userId);
  if (!project) throw notFound('Project not found');
  req.project = project;
  next();
});

router.get('/', (req, res) => {
  res.json(listTasks(req.project.id));
});

router.post('/', (req, res) => {
  const { title, status, dueDate, notes } = req.body ?? {};
  if (!title) throw badRequest('title is required');
  res.status(201).json(createTask(req.project.id, { title, status, dueDate, notes }));
});

router.get('/:taskId', (req, res) => {
  const task = getTask(Number(req.params.taskId), req.project.id);
  if (!task) throw notFound('Task not found');
  res.json(task);
});

router.patch('/:taskId', (req, res) => {
  const task = updateTask(Number(req.params.taskId), req.project.id, req.body ?? {});
  if (!task) throw notFound('Task not found');
  res.json(task);
});

router.delete('/:taskId', (req, res) => {
  const ok = deleteTask(Number(req.params.taskId), req.project.id);
  if (!ok) throw notFound('Task not found');
  res.status(204).end();
});

export default router;
