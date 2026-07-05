import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { createProjectSchema, updateProjectSchema } from '../schemas/projects.js';
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

router.post('/', validateBody(createProjectSchema), (req, res) => {
  const { name, description } = req.body;
  res.status(201).json(createProject(req.session.userId, { name, description }));
});

router.get('/:id', (req, res) => {
  const project = getProject(Number(req.params.id), req.session.userId);
  if (!project) throw notFound('Project not found');
  res.json(project);
});

router.patch('/:id', validateBody(updateProjectSchema), (req, res) => {
  const project = updateProject(Number(req.params.id), req.session.userId, req.body);
  if (!project) throw notFound('Project not found');
  res.json(project);
});

router.delete('/:id', (req, res) => {
  const ok = deleteProject(Number(req.params.id), req.session.userId);
  if (!ok) throw notFound('Project not found');
  res.status(204).end();
});

export default router;
