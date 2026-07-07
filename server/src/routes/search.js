import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { search } from '../models/search.js';

const router = Router();
router.use(requireAuth);

// GET /api/search?q=... → { projects, tasks } scoped to the user.
router.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  res.json(search(req.session.userId, q));
});

export default router;
