import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { fromProjectSchema, instantiateSchema } from '../schemas/templates.js';
import {
  createTemplateFromProject,
  deleteTemplate,
  getTemplate,
  instantiateTemplate,
  listTemplates,
} from '../models/templates.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listTemplates(req.session.userId));
});

// Save an existing project as a reusable template (sections → modules).
router.post('/from-project', validateBody(fromProjectSchema), (req, res) => {
  const template = createTemplateFromProject(req.session.userId, req.body.projectId, req.body.name);
  if (!template) throw notFound('Project not found');
  res.status(201).json(template);
});

router.get('/:id', (req, res) => {
  const template = getTemplate(Number(req.params.id), req.session.userId);
  if (!template) throw notFound('Template not found');
  res.json(template);
});

// Build a new project from a template. Returns the created project.
router.post('/:id/instantiate', validateBody(instantiateSchema), (req, res) => {
  const project = instantiateTemplate(req.session.userId, Number(req.params.id), req.body.name);
  if (!project) throw notFound('Template not found');
  res.status(201).json(project);
});

router.delete('/:id', (req, res) => {
  const ok = deleteTemplate(Number(req.params.id), req.session.userId);
  if (!ok) throw notFound('Template not found');
  res.status(204).end();
});

export default router;
