// All calls to the backend live here so components never call fetch inline.
// In dev, BASE_URL is empty and Vite proxies /api to the server.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    throw new Error(`Request to ${path} failed: ${res.status}`);
  }
  return res.json();
}

export function getHealth() {
  return request('/api/health');
}
