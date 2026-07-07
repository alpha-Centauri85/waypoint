import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import { acceptInvite, previewInvite } from '../models/members.js';

// Invite links are addressed by token (the invitee isn't a member yet), so these
// aren't nested under a project. Auth is still required — you accept as yourself.
const router = Router();
router.use(requireAuth);

// Preview an invite before accepting (project name, role, who invited you).
router.get('/:token', (req, res) => {
  const preview = previewInvite(req.params.token);
  if (preview.status === 'not_found') throw notFound('Invite not found');
  res.json(preview);
});

// Accept: join the project with the invite's role. Idempotent-ish — a used token
// reports { status: 'used' }.
router.post('/:token/accept', (req, res) => {
  const result = acceptInvite(req.params.token, req.session.userId);
  if (result.status === 'not_found') throw notFound('Invite not found');
  res.json(result);
});

export default router;
