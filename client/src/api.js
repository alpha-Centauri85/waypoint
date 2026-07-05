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

// Tasks
export const listTasks = (projectId) => request(`/api/projects/${projectId}/tasks`);
export const createTask = (projectId, title) =>
  request(`/api/projects/${projectId}/tasks`, { method: 'POST', body: { title } });
export const updateTask = (projectId, taskId, fields) =>
  request(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'PATCH', body: fields });
export const deleteTask = (projectId, taskId) =>
  request(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' });

// Subtasks
export const listSubtasks = (taskId) => request(`/api/tasks/${taskId}/subtasks`);
export const createSubtask = (taskId, title) =>
  request(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body: { title } });
export const updateSubtask = (taskId, subtaskId, fields) =>
  request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: fields });
export const deleteSubtask = (taskId, subtaskId) =>
  request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' });
