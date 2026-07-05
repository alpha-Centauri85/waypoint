import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { afterEach, describe, expect, test, vi } from 'vitest';
import TaskList, { arrangeTasks } from './TaskList.jsx';

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

describe('arrangeTasks', () => {
  const tasks = [
    { id: 1, title: 'Banana', status: 'done', due_date: '2026-03-01' },
    { id: 2, title: 'apple', status: 'todo', due_date: null },
    { id: 3, title: 'Cherry', status: 'doing', due_date: '2026-01-15' },
  ];

  test('status filter keeps only matching tasks', () => {
    expect(arrangeTasks(tasks, 'todo', 'default').map((t) => t.id)).toEqual([2]);
    expect(arrangeTasks(tasks, 'all', 'default').map((t) => t.id)).toEqual([1, 2, 3]);
  });

  test('due-date sort is chronological with no-due-date last', () => {
    expect(arrangeTasks(tasks, 'all', 'due').map((t) => t.id)).toEqual([3, 1, 2]);
  });

  test('status sort orders todo → doing → done', () => {
    expect(arrangeTasks(tasks, 'all', 'status').map((t) => t.status)).toEqual([
      'todo',
      'doing',
      'done',
    ]);
  });

  test('title sort is case-insensitive alphabetical', () => {
    expect(arrangeTasks(tasks, 'all', 'title').map((t) => t.title)).toEqual([
      'apple',
      'Banana',
      'Cherry',
    ]);
  });

  test('does not mutate the input array', () => {
    const input = [...tasks];
    arrangeTasks(input, 'all', 'title');
    expect(input.map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

test('the status filter hides non-matching tasks in the list', async () => {
  const tasks = [
    { id: 1, title: 'A todo task', status: 'todo', due_date: null, notes: null },
    { id: 2, title: 'A done task', status: 'done', due_date: null, notes: null },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (String(url).includes('/subtasks')) return jsonResponse(200, []);
      if (String(url).endsWith('/tasks')) return jsonResponse(200, tasks);
      return jsonResponse(200, []);
    }),
  );

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);
  expect(await screen.findByText('A todo task')).toBeInTheDocument();
  expect(screen.getByText('A done task')).toBeInTheDocument();

  // Filter to "Done" → the todo task disappears.
  fireEvent.click(screen.getByRole('radio', { name: 'Done' }));
  expect(screen.queryByText('A todo task')).not.toBeInTheDocument();
  expect(screen.getByText('A done task')).toBeInTheDocument();
});
