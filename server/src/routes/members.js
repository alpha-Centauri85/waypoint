import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { inviteSchema, memberRoleSchema } from '../schemas/members.js';
import {
  createInvite,
  getProjectAccess,
  listInvites,
  listMembers,
  removeMember,
  revokeInvite,
  setMemberRole,
} from '../models/members.js';

// mergeParams lets this router read :projectId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Any member may view the roster; only the owner manages it.
router.use((req, res, next) => {
  const access = getProjectAccess(Number(req.params.projectId), req.session.userId);
  if (!access) throw notFound('Project not found');
  req.project = access.project;
  req.role = access.role;
  next();
});

const requireOwner = (req) => {
  if (req.role !== 'owner') throw forbidden('Only the owner can manage members');
};

router.get('/', (req, res) => {
  res.json({
    role: req.role,
    members: listMembers(req.project.id),
    invites: listInvites(req.project.id),
  });
});

// Create a shareable invite link (returns the token; the client builds the URL).
router.post('/invites', validateBody(inviteSchema), (req, res) => {
  requireOwner(req);
  const invite = createInvite(req.project.id, req.body.role, req.session.userId);
  res.status(201).json(invite);
});

router.delete('/invites/:inviteId', (req, res) => {
  requireOwner(req);
  if (!revokeInvite(Number(req.params.inviteId), req.project.id))
    throw notFound('Invite not found');
  res.status(204).end();
});

router.patch('/:userId', validateBody(memberRoleSchema), (req, res) => {
  requireOwner(req);
  const userId = Number(req.params.userId);
  if (userId === req.project.user_id) throw badRequest("The owner's role can't be changed");
  if (!setMemberRole(req.project.id, userId, req.body.role)) throw notFound('Member not found');
  res.json(listMembers(req.project.id));
});

// Owner removes anyone; a collaborator may remove themselves (leave).
router.delete('/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  if (userId === req.project.user_id) throw badRequest("The owner can't be removed");
  if (req.role !== 'owner' && userId !== req.session.userId)
    throw forbidden('You can only remove yourself');
  if (!removeMember(req.project.id, userId)) throw notFound('Member not found');
  res.status(204).end();
});

export default router;
