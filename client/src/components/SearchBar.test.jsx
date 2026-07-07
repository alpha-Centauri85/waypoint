import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { afterEach, expect, test, vi } from 'vitest';
import SearchBar from './SearchBar.jsx';

function jsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

afterEach(() => vi.unstubAllGlobals());

test('typing searches and clicking a task result selects its project', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      jsonResponse(200, {
        projects: [{ id: 1, name: 'Website Redesign', description: null }],
        tasks: [
          {
            id: 9,
            title: 'Design homepage',
            status: 'todo',
            priority: 0,
            project_id: 1,
            project_name: 'Website Redesign',
          },
        ],
      }),
    ),
  );
  const onSelectProject = vi.fn();

  render(
    <MantineProvider>
      <SearchBar onSelectProject={onSelectProject} />
    </MantineProvider>,
  );

  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'home' } });

  // Result appears after the debounce + fetch.
  const taskResult = await screen.findByText('Design homepage');
  fireEvent.click(taskResult);

  await waitFor(() => expect(onSelectProject).toHaveBeenCalledWith(1));
});

test('does not search for queries shorter than 2 characters', async () => {
  const fetchMock = vi.fn(() => jsonResponse(200, { projects: [], tasks: [] }));
  vi.stubGlobal('fetch', fetchMock);

  render(
    <MantineProvider>
      <SearchBar onSelectProject={() => {}} />
    </MantineProvider>,
  );

  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'a' } });
  // Give the debounce time to (not) fire.
  await new Promise((r) => setTimeout(r, 300));
  expect(fetchMock).not.toHaveBeenCalled();
});
