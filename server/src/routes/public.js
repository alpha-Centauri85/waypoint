import { Router } from 'express';
import { notFound } from '../lib/errors.js';
import { getPublicProject } from '../models/publicShares.js';

// The ONLY unauthenticated read path in the app (roadmap 29). Mounted in app.js
// WITHOUT requireAuth and behind publicShareLimiter. A single GET by token; no
// other verbs and no nested routers, so a missing/revoked token — and any
// mutation attempt — falls through to the /api 404 handler. The response is the
// whitelisted projection built entirely inside models/publicShares.js.
const router = Router();

router.get('/:token', (req, res) => {
  const data = getPublicProject(req.params.token);
  // 404 (never 403) so a revoked link is indistinguishable from one that never
  // existed — no signal about which projects have (had) a share.
  if (!data) throw notFound('This link is unavailable');
  res.json(data);
});

export default router;
