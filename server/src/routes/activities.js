import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { listActivities } from '../models/activities.js';

const router = Router();
router.use(requireAuth);

// GET /api/activities?projectId=&taskId=&limit= — the signed-in user's activity,
// most-recent-first. Always user-scoped in the model, so an id for another user's
// project simply returns nothing.
router.get('/', (req, res) => {
  const { projectId, taskId, limit } = req.query;
  res.json(
    listActivities(req.session.userId, {
      projectId: projectId != null ? Number(projectId) : undefined,
      taskId: taskId != null ? Number(taskId) : undefined,
      limit,
    }),
  );
});

export default router;
