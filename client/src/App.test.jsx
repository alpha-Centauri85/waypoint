import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

// Helper to fake a fetch response.
function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('shows the sign-in form when not authenticated', async () => {
  // GET /api/auth/me → 401
  vi.stubGlobal(
    'fetch',
    vi.fn(() => jsonResponse(401, { error: 'Not authenticated' })),
  );

  render(<App />);

  expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
});

test('shows the dashboard when authenticated', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (String(url).endsWith('/api/auth/me')) {
        return jsonResponse(200, { id: 1, email: 'lee@example.com' });
      }
      if (String(url).endsWith('/api/projects')) {
        return jsonResponse(200, []);
      }
      return jsonResponse(200, []);
    }),
  );

  render(<App />);

  expect(await screen.findByText('lee@example.com')).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: /projects/i })).toBeInTheDocument();
});
