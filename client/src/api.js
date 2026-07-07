// All calls to the backend live here so components never call fetch inline.
// In dev, BASE_URL is empty and Vite proxies /api to the server.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include', // send/receive the session cookie
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request to ${path} failed (${res.status})`);
  }
  return data;
}

// Auth
export const register = (email, password) =>
  request('/api/auth/register', { method: 'POST', body: { email, password } });
export const login = (email, password) =>
  request('/api/auth/login', { method: 'POST', body: { email, password } });
export const logout = () => request('/api/auth/logout', { method: 'POST' });
export const getMe = () => request('/api/auth/me');

// Projects
export const listProjects = () => request('/api/projects');
export const createProject = (name, description) =>
  request('/api/projects', { method: 'POST', body: { name, description } });
export const updateProject = (id, fields) =>
  request(`/api/projects/${id}`, { method: 'PATCH', body: fields });
export const deleteProject = (id) => request(`/api/projects/${id}`, { method: 'DELETE' });

// Labels (per-user library)
export const listLabels = () => request('/api/labels');
export const createLabel = (name, color) =>
  request('/api/labels', { method: 'POST', body: { name, color } });
export const updateLabel = (id, fields) =>
  request(`/api/labels/${id}`, { method: 'PATCH', body: fields });
export const deleteLabel = (id) => request(`/api/labels/${id}`, { method: 'DELETE' });

// Statuses (per-user workflow states)
export const listStatuses = () => request('/api/statuses');
export const createStatus = (body) => request('/api/statuses', { method: 'POST', body });
export const updateStatus = (id, body) => request(`/api/statuses/${id}`, { method: 'PATCH', body });
export const deleteStatus = (id) => request(`/api/statuses/${id}`, { method: 'DELETE' });
export const reorderStatuses = (orderedIds) =>
  request('/api/statuses/reorder', { method: 'PATCH', body: { orderedIds } });

// Modules (reusable, label-tagged task bundles — the library)
export const listModules = () => request('/api/modules');
export const getModule = (id) => request(`/api/modules/${id}`);
export const createModule = (body) => request('/api/modules', { method: 'POST', body });
export const bulkCreateModules = (names) =>
  request('/api/modules/bulk', { method: 'POST', body: { names } });
export const updateModule = (id, body) => request(`/api/modules/${id}`, { method: 'PATCH', body });
export const deleteModule = (id) => request(`/api/modules/${id}`, { method: 'DELETE' });

// Search (projects + tasks, scoped to the user)
export const search = (q) => request(`/api/search?q=${encodeURIComponent(q)}`);

// Sharing — members, invites, and a project's owner-scoped statuses/labels.
export const listProjectStatuses = (projectId) => request(`/api/projects/${projectId}/statuses`);
export const listProjectLabels = (projectId) => request(`/api/projects/${projectId}/labels`);
export const listMembers = (projectId) => request(`/api/projects/${projectId}/members`);
export const createInvite = (projectId, role) =>
  request(`/api/projects/${projectId}/members/invites`, { method: 'POST', body: { role } });
export const revokeInvite = (projectId, inviteId) =>
  request(`/api/projects/${projectId}/members/invites/${inviteId}`, { method: 'DELETE' });
export const setMemberRole = (projectId, userId, role) =>
  request(`/api/projects/${projectId}/members/${userId}`, { method: 'PATCH', body: { role } });
export const removeMember = (projectId, userId) =>
  request(`/api/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
export const previewInvite = (token) => request(`/api/invites/${token}`);
export const acceptInvite = (token) => request(`/api/invites/${token}/accept`, { method: 'POST' });

// Activity log (most-recent-first; scope by project or task)
export const listActivities = ({ projectId, taskId, limit } = {}) => {
  const params = new URLSearchParams();
  if (projectId != null) params.set('projectId', projectId);
  if (taskId != null) params.set('taskId', taskId);
  if (limit != null) params.set('limit', limit);
  const qs = params.toString();
  return request(`/api/activities${qs ? `?${qs}` : ''}`);
};

// Templates (reusable project blueprints)
export const listTemplates = () => request('/api/templates');
export const getTemplate = (id) => request(`/api/templates/${id}`);
export const createTemplate = (body) => request('/api/templates', { method: 'POST', body });
export const updateTemplate = (id, body) =>
  request(`/api/templates/${id}`, { method: 'PATCH', body });
// Save a project as a new template (name) or overwrite an existing one (templateId).
export const createTemplateFromProject = (projectId, name) =>
  request('/api/templates/from-project', { method: 'POST', body: { projectId, name } });
export const overwriteTemplateFromProject = (projectId, templateId) =>
  request('/api/templates/from-project', { method: 'POST', body: { projectId, templateId } });
// sectionLabels: [{ sectionId, labelIds }] chosen at creation time (optional).
export const instantiateTemplate = (id, name, sectionLabels) =>
  request(`/api/templates/${id}/instantiate`, {
    method: 'POST',
    body: { name, ...(sectionLabels ? { sectionLabels } : {}) },
  });
export const deleteTemplate = (id) => request(`/api/templates/${id}`, { method: 'DELETE' });

// Sections (task groupings within a project)
export const listSections = (projectId) => request(`/api/projects/${projectId}/sections`);
export const createSection = (projectId, name) =>
  request(`/api/projects/${projectId}/sections`, { method: 'POST', body: { name } });
export const updateSection = (projectId, sectionId, fields) =>
  request(`/api/projects/${projectId}/sections/${sectionId}`, { method: 'PATCH', body: fields });
export const deleteSection = (projectId, sectionId) =>
  request(`/api/projects/${projectId}/sections/${sectionId}`, { method: 'DELETE' });
export const reorderSections = (projectId, orderedIds) =>
  request(`/api/projects/${projectId}/sections/reorder`, {
    method: 'PATCH',
    body: { orderedIds },
  });

// Tasks
export const listTasks = (projectId) => request(`/api/projects/${projectId}/tasks`);
export const createTask = (projectId, title, extra = {}) =>
  request(`/api/projects/${projectId}/tasks`, { method: 'POST', body: { title, ...extra } });
export const updateTask = (projectId, taskId, fields) =>
  request(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: fields });
export const deleteTask = (projectId, taskId) =>
  request(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });
export const reorderTasks = (projectId, orderedIds) =>
  request(`/api/projects/${projectId}/tasks/reorder`, { method: 'PATCH', body: { orderedIds } });

// Subtasks
export const listSubtasks = (taskId) => request(`/api/tasks/${taskId}/subtasks`);
export const createSubtask = (taskId, title) =>
  request(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body: { title } });
export const updateSubtask = (taskId, subtaskId, fields) =>
  request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: fields });
export const deleteSubtask = (taskId, subtaskId) =>
  request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' });

// Comments (a thread on a task)
export const listComments = (taskId) => request(`/api/tasks/${taskId}/comments`);
export const createComment = (taskId, body) =>
  request(`/api/tasks/${taskId}/comments`, { method: 'POST', body: { body } });
export const updateComment = (taskId, commentId, body) =>
  request(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'PATCH', body: { body } });
export const deleteComment = (taskId, commentId) =>
  request(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
