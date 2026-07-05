import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { afterEach, expect, test, vi } from 'vitest';
import TaskList from './TaskList.jsx';

function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function renderWithProviders(ui) {
  return render(
    <MantineProvider>
      <Notifications />
      {ui}
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('editing a task opens a prefilled modal and PATCHes the changes', async () => {
  const task = { id: 7, title: 'Original title', status: 'todo', due_date: null, notes: null };
  const calls = [];

  vi.stubGlobal(
    'fetch',
    vi.fn((url, opts = {}) => {
      calls.push({ url: String(url), opts });
      if (String(url).includes('/subtasks')) return jsonResponse(200, []);
      if (String(url).endsWith('/tasks')) return jsonResponse(200, [task]);
      if (opts.method === 'PATCH') return jsonResponse(200, { ...task, title: 'Updated title' });
      return jsonResponse(200, []);
    }),
  );

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);

  // The task renders.
  expect(await screen.findByText('Original title')).toBeInTheDocument();

  // Open the edit modal; it should be prefilled from the task.
  fireEvent.click(screen.getByRole('button', { name: /edit task/i }));
  const dialog = await screen.findByRole('dialog');
  const titleInput = within(dialog).getByLabelText(/title/i);
  expect(titleInput).toHaveValue('Original title');

  // Change the title and save.
  fireEvent.change(titleInput, { target: { value: 'Updated title' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

  await waitFor(() => {
    const patch = calls.find((c) => c.opts.method === 'PATCH');
    expect(patch).toBeTruthy();
    expect(patch.url).toContain('/api/projects/1/tasks/7');
    expect(JSON.parse(patch.opts.body)).toMatchObject({ title: 'Updated title', status: 'todo' });
  });
});
