import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { createLabelSchema, updateLabelSchema } from '../schemas/labels.js';
import { createLabel, deleteLabel, listLabels, updateLabel } from '../models/labels.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listLabels(req.session.userId));
});

router.post('/', validateBody(createLabelSchema), (req, res) => {
  res.status(201).json(createLabel(req.session.userId, req.body));
});

router.patch('/:id', validateBody(updateLabelSchema), (req, res) => {
  const label = updateLabel(Number(req.params.id), req.session.userId, req.body);
  if (!label) throw notFound('Label not found');
  res.json(label);
});

router.delete('/:id', (req, res) => {
  const ok = deleteLabel(Number(req.params.id), req.session.userId);
  if (!ok) throw notFound('Label not found');
  res.status(204).end();
});

export default router;
