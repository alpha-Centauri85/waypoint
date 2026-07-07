import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { createCommentSchema, updateCommentSchema } from '../schemas/comments.js';
import { getTaskForUser } from '../models/tasks.js';
import { createComment, deleteComment, listComments, updateComment } from '../models/comments.js';
import { logActivity } from '../models/activities.js';

// mergeParams lets this router read :taskId from the mount path.
const router = Router({ mergeParams: true });
router.use(requireAuth);

// Authorize the parent task (must belong to a project owned by the user).
router.use((req, res, next) => {
  const task = getTaskForUser(Number(req.params.taskId), req.session.userId);
  if (!task) throw notFound('Task not found');
  req.task = task;
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
