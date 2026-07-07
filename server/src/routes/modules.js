import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { bulkCreateSchema, createModuleSchema, updateModuleSchema } from '../schemas/modules.js';
import {
  bulkCreateModules,
  createModule,
  deleteModule,
  getModule,
  listModules,
  updateModule,
} from '../models/modules.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listModules(req.session.userId));
});

router.post('/', validateBody(createModuleSchema), (req, res) => {
  res.status(201).json(createModule(req.session.userId, req.body));
});

// Create several empty modules at once. Before '/:id' isn't needed (distinct path).
router.post('/bulk', validateBody(bulkCreateSchema), (req, res) => {
  res.status(201).json(bulkCreateModules(req.session.userId, req.body.names));
});

router.get('/:id', (req, res) => {
  const module = getModule(Number(req.params.id), req.session.userId);
  if (!module) throw notFound('Module not found');
  res.json(module);
});

router.patch('/:id', validateBody(updateModuleSchema), (req, res) => {
  const module = updateModule(req.session.userId, Number(req.params.id), req.body);
  if (!module) throw notFound('Module not found');
  res.json(module);
});

router.delete('/:id', (req, res) => {
  const ok = deleteModule(Number(req.params.id), req.session.userId);
  if (!ok) throw notFound('Module not found');
  res.status(204).end();
});

export default router;
