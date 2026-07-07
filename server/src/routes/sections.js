import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { getProjectAccess } from '../models/members.js';
import {
  createSection,
  deleteSection,
  listSections,
  reorderSections,
  updateSection,
} from '../models/sections.js';
import {
  createSectionSchema,
  reorderSectionsSchema,
  updateSectionSchema,
} from '../schemas/sections.js';

// mergeParams lets this router read :projectId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Authorize the parent project once for every section route below (owner/member).
router.use((req, res, next) => {
  const access = getProjectAccess(Number(req.params.projectId), req.session.userId);
  if (!access) throw notFound('Project not found');
  req.project = access.project;
  req.role = access.role;
  next();
});

// Viewers are read-only.
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.role === 'viewer')
    throw forbidden('You have read-only access to this project');
  next();
});

router.get('/', (req, res) => {
  res.json(listSections(req.project.id));
});

router.post('/', validateBody(createSectionSchema), (req, res) => {
  res.status(201).json(createSection(req.project.id, req.body));
});

// Before '/:id' so 'reorder' isn't parsed as a section id.
router.patch('/reorder', validateBody(reorderSectionsSchema), (req, res) => {
  const sections = reorderSections(req.project.id, req.body.orderedIds);
  if (!sections) throw badRequest("orderedIds must list exactly this project's section ids");
  res.json(sections);
});

router.patch('/:id', validateBody(updateSectionSchema), (req, res) => {
  const section = updateSection(Number(req.params.id), req.project.id, req.body);
  if (!section) throw notFound('Section not found');
  res.json(section);
});

router.delete('/:id', (req, res) => {
  const ok = deleteSection(Number(req.params.id), req.project.id);
  if (!ok) throw notFound('Section not found');
  res.status(204).end();
});

export default router;
