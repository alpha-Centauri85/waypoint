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
