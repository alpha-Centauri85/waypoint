import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App.jsx';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'ok' }) }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('renders the app title', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /waypoint/i })).toBeInTheDocument();
});

test('shows the API status once loaded', async () => {
  render(<App />);
  expect(await screen.findByText('ok')).toBeInTheDocument();
});
