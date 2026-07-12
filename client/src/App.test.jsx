import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

test('theme toggle flips the colour scheme and persists it via PATCH /api/auth/me', async () => {
  const fetchMock = vi.fn((url, opts = {}) => {
    if (String(url).endsWith('/api/auth/me') && opts.method === 'PATCH') {
      return jsonResponse(200, { id: 1, email: 'lee@example.com', theme: 'light' });
    }
    if (String(url).endsWith('/api/auth/me')) {
      return jsonResponse(200, { id: 1, email: 'lee@example.com', theme: 'dark' });
    }
    return jsonResponse(200, []);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<App />);

  // Wait for the authenticated shell, then open the user menu.
  fireEvent.click(await screen.findByRole('button', { name: /lee@example.com/i }));
  fireEvent.click(await screen.findByRole('menuitem', { name: /light mode/i }));

  // The scheme flips to light on the document root...
  await waitFor(() =>
    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('light'),
  );

  // ...and the choice is persisted server-side.
  const patchCall = fetchMock.mock.calls.find(
    ([url, opts]) => String(url).endsWith('/api/auth/me') && opts?.method === 'PATCH',
  );
  expect(patchCall).toBeTruthy();
  expect(JSON.parse(patchCall[1].body)).toEqual({ theme: 'light' });
});
