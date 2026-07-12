import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { afterEach, describe, expect, test, vi } from 'vitest';
import TaskList, { arrangeTasks, moveTask } from './TaskList.jsx';
import { StatusesProvider } from '../statuses.jsx';

// Seeded workflow statuses returned to the StatusesProvider.
const STATUSES = [
  { id: 101, name: 'To do', color: 'gray', is_done: 0, key: 'todo' },
  { id: 102, name: 'In progress', color: 'amber', is_done: 0, key: 'doing' },
  { id: 103, name: 'Done', color: 'teal', is_done: 1, key: 'done' },
];

function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

// Wrap a per-test route handler so /api/statuses (+ subtasks/sections) are always
// answered; `routes(url, opts)` handles the rest.
function stubFetch(calls, routes) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url, opts = {}) => {
      calls.push({ url: String(url), opts });
      const u = String(url);
      if (u.includes('/api/statuses')) return jsonResponse(200, STATUSES);
      if (u.includes('/subtasks')) return jsonResponse(200, []);
      if (u.includes('/sections')) return jsonResponse(200, []);
      return routes(u, opts) ?? jsonResponse(200, []);
    }),
  );
}

function renderWithProviders(ui) {
  return render(
    <MantineProvider>
      <Notifications />
      <StatusesProvider>{ui}</StatusesProvider>
    </MantineProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('editing a task opens a prefilled modal and PATCHes the changes', async () => {
  const task = {
    id: 7,
    title: 'Original title',
    status_id: 101,
    due_date: null,
    notes: null,
    labels: [],
  };
  const calls = [];
  stubFetch(calls, (u, opts) => {
    if (u.endsWith('/tasks')) return jsonResponse(200, [task]);
    if (opts.method === 'PATCH') return jsonResponse(200, { ...task, title: 'Updated title' });
    return null;
  });

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);
  expect(await screen.findByText('Original title')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /edit task/i }));
  const dialog = await screen.findByRole('dialog');
  const titleInput = within(dialog).getByLabelText(/title/i);
  expect(titleInput).toHaveValue('Original title');

  fireEvent.change(titleInput, { target: { value: 'Updated title' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /save/i }));

  await waitFor(() => {
    const patch = calls.find((c) => c.opts.method === 'PATCH' && c.url.endsWith('/tasks/7'));
    expect(patch).toBeTruthy();
    expect(JSON.parse(patch.opts.body)).toMatchObject({ title: 'Updated title', statusId: 101 });
  });
});

describe('arrangeTasks', () => {
  const tasks = [
    { id: 1, title: 'Banana', status_id: 103, due_date: '2026-03-01' },
    { id: 2, title: 'apple', status_id: 101, due_date: null },
    { id: 3, title: 'Cherry', status_id: 102, due_date: '2026-01-15' },
  ];
  const positionById = { 101: 0, 102: 1, 103: 2 };

  test('status filter keeps only tasks with that status id', () => {
    expect(arrangeTasks(tasks, '101', 'default').map((t) => t.id)).toEqual([2]);
    expect(arrangeTasks(tasks, 'all', 'default').map((t) => t.id)).toEqual([1, 2, 3]);
  });

  test('due-date sort is chronological with no-due-date last', () => {
    expect(arrangeTasks(tasks, 'all', 'due').map((t) => t.id)).toEqual([3, 1, 2]);
  });

  test('status sort follows workflow order', () => {
    expect(arrangeTasks(tasks, 'all', 'status', [], positionById).map((t) => t.status_id)).toEqual([
      101, 102, 103,
    ]);
  });

  test('priority sort puts the highest priority first', () => {
    const withPriority = [
      { id: 1, title: 'a', status_id: 101, due_date: null, priority: 1 },
      { id: 2, title: 'b', status_id: 101, due_date: null, priority: 4 },
      { id: 3, title: 'c', status_id: 101, due_date: null, priority: 2 },
    ];
    expect(arrangeTasks(withPriority, 'all', 'priority').map((t) => t.id)).toEqual([2, 3, 1]);
  });

  test('title sort is case-insensitive alphabetical', () => {
    expect(arrangeTasks(tasks, 'all', 'title').map((t) => t.title)).toEqual([
      'apple',
      'Banana',
      'Cherry',
    ]);
  });

  test('label filter keeps tasks carrying any selected label', () => {
    const labelled = [
      { id: 1, title: 'a', status_id: 101, due_date: null, labels: [{ id: 5 }] },
      { id: 2, title: 'b', status_id: 101, due_date: null, labels: [{ id: 6 }] },
      { id: 3, title: 'c', status_id: 101, due_date: null, labels: [] },
    ];
    expect(arrangeTasks(labelled, 'all', 'default', [5]).map((t) => t.id)).toEqual([1]);
    expect(arrangeTasks(labelled, 'all', 'default', [5, 6]).map((t) => t.id)).toEqual([1, 2]);
    expect(arrangeTasks(labelled, 'all', 'default', []).map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

describe('moveTask', () => {
  const tasks = [{ id: 1 }, { id: 2 }, { id: 3 }];

  test('moves an item down to the target position', () => {
    expect(moveTask(tasks, 1, 3).map((t) => t.id)).toEqual([2, 3, 1]);
  });

  test('moves an item up to the target position', () => {
    expect(moveTask(tasks, 3, 1).map((t) => t.id)).toEqual([3, 1, 2]);
  });

  test('is a no-op for the same id or an unknown id', () => {
    expect(moveTask(tasks, 2, 2)).toBe(tasks);
    expect(moveTask(tasks, 99, 1)).toBe(tasks);
  });

  test('does not mutate the input', () => {
    const input = [...tasks];
    moveTask(input, 1, 3);
    expect(input.map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

test('dragging a task onto another PATCHes the new order', async () => {
  const tasks = [
    {
      id: 1,
      title: 'A',
      status_id: 101,
      due_date: null,
      notes: null,
      section_id: null,
      labels: [],
    },
    {
      id: 2,
      title: 'B',
      status_id: 101,
      due_date: null,
      notes: null,
      section_id: null,
      labels: [],
    },
    {
      id: 3,
      title: 'C',
      status_id: 101,
      due_date: null,
      notes: null,
      section_id: null,
      labels: [],
    },
  ];
  const calls = [];
  stubFetch(calls, (u) => {
    if (u.includes('/reorder')) return jsonResponse(200, tasks);
    if (u.endsWith('/tasks')) return jsonResponse(200, tasks);
    return null;
  });

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);
  const rowA = (await screen.findByText('A')).closest('[draggable="true"]');
  const rowC = screen.getByText('C').closest('[draggable="true"]');

  fireEvent.dragStart(rowA);
  fireEvent.dragOver(rowC);
  fireEvent.drop(rowC);

  await waitFor(() => {
    const reorder = calls.find((c) => c.url.includes('/reorder'));
    expect(JSON.parse(reorder.opts.body)).toEqual({ orderedIds: [2, 3, 1] });
  });
});

test('dragging a task into another section PATCHes its sectionId and reorders', async () => {
  const tasks = [
    {
      id: 1,
      title: 'In A',
      status_id: 101,
      due_date: null,
      notes: null,
      section_id: 10,
      labels: [],
    },
    {
      id: 2,
      title: 'In B',
      status_id: 101,
      due_date: null,
      notes: null,
      section_id: 20,
      labels: [],
    },
  ];
  const sections = [
    { id: 10, name: 'Alpha', position: 0 },
    { id: 20, name: 'Beta', position: 1 },
  ];
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, opts = {}) => {
      calls.push({ url: String(url), opts });
      const u = String(url);
      if (u.includes('/api/statuses')) return jsonResponse(200, STATUSES);
      if (u.includes('/subtasks')) return jsonResponse(200, []);
      if (u.includes('/sections')) return jsonResponse(200, sections);
      if (u.endsWith('/tasks')) return jsonResponse(200, tasks);
      return jsonResponse(200, tasks);
    }),
  );

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);
  const rowA = (await screen.findByText('In A')).closest('[draggable="true"]');
  const rowB = screen.getByText('In B').closest('[draggable="true"]');

  fireEvent.dragStart(rowA);
  fireEvent.dragOver(rowB);
  fireEvent.drop(rowB);

  await waitFor(() => {
    const patch = calls.find((c) => c.opts.method === 'PATCH' && c.url.endsWith('/tasks/1'));
    expect(JSON.parse(patch.opts.body)).toMatchObject({ sectionId: 20 });
    expect(calls.find((c) => c.url.includes('/tasks/reorder'))).toBeTruthy();
  });
});

test('a section description is shown, and editing it PATCHes name + description', async () => {
  const sections = [{ id: 10, name: 'Alpha', description: 'Kickoff notes', position: 0 }];
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, opts = {}) => {
      calls.push({ url: String(url), opts });
      const u = String(url);
      if (u.includes('/api/statuses')) return jsonResponse(200, STATUSES);
      if (u.includes('/subtasks')) return jsonResponse(200, []);
      if (u.includes('/sections')) return jsonResponse(200, sections);
      if (u.endsWith('/tasks')) return jsonResponse(200, []);
      return jsonResponse(200, []);
    }),
  );

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);

  // The description shows under the section header when non-empty.
  expect(await screen.findByText('Kickoff notes')).toBeInTheDocument();

  // Open the inline editor and change both fields.
  fireEvent.click(screen.getByLabelText('Rename section'));
  const nameInput = screen.getByDisplayValue('Alpha');
  fireEvent.change(nameInput, { target: { value: 'Beta' } });
  const descriptionInput = screen.getByDisplayValue('Kickoff notes');
  fireEvent.change(descriptionInput, { target: { value: 'Updated notes' } });
  fireEvent.click(screen.getByLabelText('Save section'));

  await waitFor(() => {
    const patch = calls.find((c) => c.opts.method === 'PATCH' && c.url.endsWith('/sections/10'));
    expect(patch).toBeTruthy();
    expect(JSON.parse(patch.opts.body)).toEqual({ name: 'Beta', description: 'Updated notes' });
  });
});

test('clicking a task status opens a menu to pick any status', async () => {
  const task = { id: 5, title: 'Pick me', status_id: 101, due_date: null, notes: null, labels: [] };
  const calls = [];
  stubFetch(calls, (u, opts) => {
    if (u.endsWith('/tasks')) return jsonResponse(200, [task]);
    if (opts.method === 'PATCH') return jsonResponse(200, { ...task, status_id: 103 });
    return null;
  });

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);
  // The row badge shows the current status; click it to open the picker.
  fireEvent.click(await screen.findByLabelText(/^Status: To do/));
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Done' }));

  await waitFor(() => {
    const patch = calls.find((c) => c.opts.method === 'PATCH' && c.url.endsWith('/tasks/5'));
    expect(patch).toBeTruthy();
    expect(JSON.parse(patch.opts.body)).toEqual({ statusId: 103 });
  });
});

test('board view: dragging a card to another column changes its status', async () => {
  const tasks = [
    {
      id: 1,
      title: 'Card A',
      status_id: 101,
      due_date: null,
      notes: null,
      section_id: null,
      labels: [],
    },
    {
      id: 2,
      title: 'Card B',
      status_id: 102,
      due_date: null,
      notes: null,
      section_id: null,
      labels: [],
    },
  ];
  const calls = [];
  stubFetch(calls, (u) => {
    if (u.endsWith('/tasks')) return jsonResponse(200, tasks);
    return jsonResponse(200, tasks);
  });

  renderWithProviders(<TaskList project={{ id: 1, name: 'P' }} />);
  fireEvent.click(await screen.findByText('Board'));

  const cardA = (await screen.findByText('Card A')).closest('[draggable="true"]');
  const doneColumn = screen.getByLabelText('Done column');

  fireEvent.dragStart(cardA);
  fireEvent.dragOver(doneColumn);
  fireEvent.drop(doneColumn);

  await waitFor(() => {
    const patch = calls.find((c) => c.opts.method === 'PATCH' && c.url.endsWith('/tasks/1'));
    expect(JSON.parse(patch.opts.body)).toEqual({ statusId: 103 });
  });
});
