import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '../models/projects.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listProjects(req.session.userId));
});

router.post('/', (req, res) => {
  const { name, description } = req.body ?? {};
  if (!name) throw badRequest('name is required');
  res.status(201).json(createProject(req.session.userId, { name, description }));
});

router.get('/:id', (req, res) => {
  const project = getProject(Number(req.params.id), req.session.userId);
  if (!project) throw notFound('Project not found');
  res.json(project);
});

router.patch('/:id', (req, res) => {
  const project = updateProject(Number(req.params.id), req.session.userId, req.body ?? {});
  if (!project) throw notFound('Project not found');
  res.json(project);
});

router.delete('/:id', (req, res) => {
  const ok = deleteProject(Number(req.params.id), req.session.userId);
  if (!ok) throw notFound('Project not found');
  res.status(204).end();
});

export default router;
