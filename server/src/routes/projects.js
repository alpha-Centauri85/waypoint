import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { forbidden, notFound } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { createProjectSchema, updateProjectSchema } from '../schemas/projects.js';
import {
  createProject,
  deleteProject,
  getProjectById,
  listProjectsForUser,
  updateProject,
} from '../models/projects.js';
import { getProjectAccess } from '../models/members.js';
import { listLabels, setProjectLabels } from '../models/labels.js';
import { ensureStatuses, listStatuses } from '../models/statuses.js';
import { logActivity } from '../models/activities.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(listProjectsForUser(req.session.userId));
});

router.post('/', validateBody(createProjectSchema), (req, res) => {
  const { name, description, labelIds } = req.body;
  const project = createProject(req.session.userId, { name, description });
  if (labelIds) setProjectLabels(project.id, req.session.userId, labelIds);
  logActivity(req.session.userId, {
    projectId: project.id,
    action: 'project.created',
    summary: `Created project “${project.name}”`,
  });
  res.status(201).json(getProjectById(project.id));
});

router.get('/:id', (req, res) => {
  const access = getProjectAccess(Number(req.params.id), req.session.userId);
  if (!access) throw notFound('Project not found');
  res.json({ ...access.project, role: access.role });
});

// Rename / edit: owner or editor (viewers are read-only). Writes go through the
// owner's user_id so a collaborator's edit still matches the owner-scoped row and
// project labels stay in the owner's pool.
router.patch('/:id', validateBody(updateProjectSchema), (req, res) => {
  const access = getProjectAccess(Number(req.params.id), req.session.userId);
  if (!access) throw notFound('Project not found');
  if (access.role === 'viewer') throw forbidden('You have read-only access to this project');
  const ownerId = access.project.user_id;
  const before = access.project;
  const project = updateProject(Number(req.params.id), ownerId, req.body);
  if ('labelIds' in req.body) setProjectLabels(project.id, ownerId, req.body.labelIds);
  const renamed = project.name !== before.name;
  logActivity(req.session.userId, {
    projectId: project.id,
    action: renamed ? 'project.renamed' : 'project.updated',
    summary: renamed ? `Renamed project to “${project.name}”` : `Updated project “${project.name}”`,
  });
  res.json({ ...getProjectById(project.id), role: access.role });
});

// The project's statuses + labels come from the OWNER's library, so a
// collaborator's board columns / label pickers resolve against the same sets the
// tasks were tagged with. Any member may read them.
router.get('/:id/statuses', (req, res) => {
  const access = getProjectAccess(Number(req.params.id), req.session.userId);
  if (!access) throw notFound('Project not found');
  const ownerId = access.project.user_id;
  ensureStatuses(ownerId);
  res.json(listStatuses(ownerId));
});

router.get('/:id/labels', (req, res) => {
  const access = getProjectAccess(Number(req.params.id), req.session.userId);
  if (!access) throw notFound('Project not found');
  res.json(listLabels(access.project.user_id));
});

// Delete: owner only.
router.delete('/:id', (req, res) => {
  const access = getProjectAccess(Number(req.params.id), req.session.userId);
  if (!access) throw notFound('Project not found');
  if (access.role !== 'owner') throw forbidden('Only the owner can delete this project');
  deleteProject(Number(req.params.id), access.project.user_id);
  res.status(204).end();
});

export default router;
