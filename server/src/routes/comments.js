import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { forbidden, notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { createCommentSchema, updateCommentSchema } from '../schemas/comments.js';
import { getTaskById } from '../models/tasks.js';
import { getProjectAccess } from '../models/members.js';
import { createComment, deleteComment, listComments, updateComment } from '../models/comments.js';
import { logActivity } from '../models/activities.js';

// mergeParams lets this router read :taskId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Authorize via the task's project (owner or member); viewers can read but not
// write. Edit/delete stay author-scoped in the model (only your own comments).
router.use((req, res, next) => {
  const task = getTaskById(Number(req.params.taskId));
  const access = task && getProjectAccess(task.project_id, req.session.userId);
  if (!access) throw notFound('Task not found');
  if (req.method !== 'GET' && access.role === 'viewer')
    throw forbidden('You have read-only access to this project');
  req.task = task;
  req.role = access.role;
  next();
});

router.get('/', (req, res) => {
  res.json(listComments(req.task.id));
});

router.post('/', validateBody(createCommentSchema), (req, res) => {
  const comment = createComment(req.task.id, req.session.userId, req.body);
  logActivity(req.session.userId, {
    projectId: req.task.project_id,
    taskId: req.task.id,
    action: 'comment.added',
    summary: `Commented on “${req.task.title}”`,
  });
  res.status(201).json(comment);
});

router.patch('/:commentId', validateBody(updateCommentSchema), (req, res) => {
  const comment = updateComment(
    Number(req.params.commentId),
    req.task.id,
    req.session.userId,
    req.body,
  );
  if (!comment) throw notFound('Comment not found');
  res.json(comment);
});

router.delete('/:commentId', (req, res) => {
  const ok = deleteComment(Number(req.params.commentId), req.task.id, req.session.userId);
  if (!ok) throw notFound('Comment not found');
  res.status(204).end();
});

export default router;
