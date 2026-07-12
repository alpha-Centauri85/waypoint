import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import {
  listNotifications,
  markAllRead,
  markRead,
  runReminders,
  unreadCount,
} from '../models/notifications.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications?limit= → { items, unreadCount } for the header bell.
router.get('/', (req, res) => {
  const userId = req.session.userId;
  res.json({
    items: listNotifications(userId, { limit: req.query.limit }),
    unreadCount: unreadCount(userId),
  });
});

// POST /api/notifications/run — trigger the due-date sweep now. Idempotent, so
// it's safe to hit repeatedly (e.g. a scheduled task on the media server, or to
// verify the feature). Returns how many new notifications were created.
router.post('/run', (req, res) => {
  res.json({ created: runReminders() });
});

// POST /api/notifications/read-all — mark all the user's notifications read.
router.post('/read-all', (req, res) => {
  res.json({ updated: markAllRead(req.session.userId) });
});

// POST /api/notifications/:id/read — mark one read (scoped to the user).
router.post('/:id/read', (req, res) => {
  if (!markRead(Number(req.params.id), req.session.userId))
    throw notFound('Notification not found');
  res.json({ ok: true });
});

export default router;
