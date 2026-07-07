import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest, notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import {
  createStatusSchema,
  reorderStatusesSchema,
  updateStatusSchema,
} from '../schemas/statuses.js';
import {
  createStatus,
  deleteStatus,
  listStatuses,
  reorderStatuses,
  updateStatus,
} from '../models/statuses.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listStatuses(req.session.userId));
});

router.post('/', validateBody(createStatusSchema), (req, res) => {
  res.status(201).json(createStatus(req.session.userId, req.body));
});

// Before '/:id' so 'reorder' isn't parsed as a status id.
router.patch('/reorder', validateBody(reorderStatusesSchema), (req, res) => {
  const statuses = reorderStatuses(req.session.userId, req.body.orderedIds);
  if (!statuses) throw badRequest('orderedIds must list exactly your status ids');
  res.json(statuses);
});

router.patch('/:id', validateBody(updateStatusSchema), (req, res) => {
  const status = updateStatus(Number(req.params.id), req.session.userId, req.body);
  if (!status) throw notFound('Status not found');
  res.json(status);
});

router.delete('/:id', (req, res) => {
  const result = deleteStatus(Number(req.params.id), req.session.userId);
  if (result.error === 'not_found') throw notFound('Status not found');
  if (result.error === 'last') throw badRequest('Cannot delete your only status');
  res.status(204).end();
});

export default router;
