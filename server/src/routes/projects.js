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
import { setProjectLabels } from '../models/labels.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listProjects(req.session.userId));
});

router.post('/', validateBody(createProjectSchema), (req, res) => {
  const { name, description, labelIds } = req.body;
  const project = createProject(req.session.userId, { name, description });
  if (labelIds) setProjectLabels(project.id, req.session.userId, labelIds);
  res.status(201).json(getProject(project.id, req.session.userId));
});

router.get('/:id', (req, res) => {
  const project = getProject(Number(req.params.id), req.session.userId);
  if (!project) throw notFound('Project not found');
  res.json(project);
});

router.patch('/:id', validateBody(updateProjectSchema), (req, res) => {
  const project = updateProject(Number(req.params.id), req.session.userId, req.body);
  if (!project) throw notFound('Project not found');
  if ('labelIds' in req.body) setProjectLabels(project.id, req.session.userId, req.body.labelIds);
  res.json(getProject(project.id, req.session.userId));
});

router.delete('/:id', (req, res) => {
  const ok = deleteProject(Number(req.params.id), req.session.userId);
  if (!ok) throw notFound('Project not found');
  res.status(204).end();
});

export default router;
