import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import { listActivities, listProjectActivities } from '../models/activities.js';
import { getProjectAccess } from '../models/members.js';
import { getTaskById } from '../models/tasks.js';

const router = Router();
router.use(requireAuth);

// GET /api/activities?projectId=&taskId=&limit=
//  - projectId (or taskId): the whole project's trail (all members), gated by
//    project access — shows author_email so shared projects read coherently.
//  - neither: the signed-in user's own recent actions.
router.get('/', (req, res) => {
  const { projectId, taskId, limit } = req.query;
  let pid = projectId != null ? Number(projectId) : null;
  const tid = taskId != null ? Number(taskId) : null;

  if (pid == null && tid != null) {
    const task = getTaskById(tid);
    if (!task) throw notFound('Task not found');
    pid = task.project_id;
  }

  if (pid != null) {
    if (!getProjectAccess(pid, req.session.userId)) throw notFound('Project not found');
    return res.json(listProjectActivities(pid, { taskId: tid, limit }));
  }
  res.json(listActivities(req.session.userId, { limit }));
});

export default router;
