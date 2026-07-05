import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { ArrowUpDown, CalendarClock, FileText, Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { createTask, deleteTask, listTasks, updateTask } from '../api.js';
import Subtasks from './Subtasks.jsx';
import TaskEditModal from './TaskEditModal.jsx';

const STATUSES = ['todo', 'doing', 'done'];
const STATUS_COLOR = { todo: 'gray', doing: 'blue', done: 'green' };

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'To do', value: 'todo' },
  { label: 'Doing', value: 'doing' },
  { label: 'Done', value: 'done' },
];

const SORT_OPTIONS = [
  { value: 'default', label: 'Manual order' },
  { value: 'due', label: 'Due date' },
  { value: 'status', label: 'Status' },
  { value: 'title', label: 'Title' },
];

// A task is overdue when its due date is in the past and it isn't done yet.
function isOverdue(task) {
  return task.due_date && task.status !== 'done' && dayjs(task.due_date).isBefore(dayjs(), 'day');
}

// Apply the current status filter and sort. Due dates are ISO strings
// (YYYY-MM-DD), which sort chronologically as plain strings; tasks without a due
// date sort last. Sorting is non-mutating (works on a copy). Exported for tests.
export function arrangeTasks(tasks, statusFilter, sortBy) {
  const filtered = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);
  const sorted = [...filtered];
  if (sortBy === 'due') {
    sorted.sort((a, b) => {
      if (a.due_date === b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    });
  } else if (sortBy === 'status') {
    sorted.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
  } else if (sortBy === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }
  return sorted;
}

export default function TaskList({ project }) {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');

  const visibleTasks = useMemo(
    () => arrangeTasks(tasks, statusFilter, sortBy),
    [tasks, statusFilter, sortBy],
  );

  async function refresh() {
    setTasks(await listTasks(project.id));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    await createTask(project.id, title);
    setNewTitle('');
    refresh();
  }

  async function cycleStatus(task) {
    const next = STATUSES[(STATUSES.indexOf(task.status) + 1) % STATUSES.length];
    await updateTask(project.id, task.id, { status: next });
    refresh();
  }

  return (
    <Stack>
      <div>
        <Title order={3}>{project.name}</Title>
        {project.description && <Text c="dimmed">{project.description}</Text>}
      </div>

      <form onSubmit={handleCreate}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            placeholder="New task"
            value={newTitle}
            onChange={(e) => setNewTitle(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button type="submit">Add task</Button>
        </Group>
      </form>

      {tasks.length > 0 && (
        <Group justify="space-between" gap="xs">
          <SegmentedControl
            size="xs"
            value={statusFilter}
            onChange={setStatusFilter}
            data={STATUS_FILTERS}
          />
          <Select
            size="xs"
            w={150}
            aria-label="Sort tasks"
            leftSection={<ArrowUpDown size={14} />}
            data={SORT_OPTIONS}
            value={sortBy}
            onChange={(v) => setSortBy(v ?? 'default')}
            allowDeselect={false}
          />
        </Group>
      )}

      <Stack gap="sm">
        {visibleTasks.map((task) => (
          <Paper key={task.id} withBorder p="sm" radius="md">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Tooltip label="Click to change status" openDelay={400}>
                  <Badge
                    color={STATUS_COLOR[task.status]}
                    variant="filled"
                    style={{ cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => cycleStatus(task)}
                  >
                    {task.status}
                  </Badge>
                </Tooltip>
                <Text truncate>{task.title}</Text>
                {task.notes && (
                  <Tooltip label={task.notes} multiline maw={280}>
                    <FileText size={15} style={{ flexShrink: 0, opacity: 0.6 }} />
                  </Tooltip>
                )}
                {task.due_date && (
                  <Badge
                    variant="light"
                    color={isOverdue(task) ? 'red' : 'gray'}
                    leftSection={<CalendarClock size={12} />}
                    style={{ flexShrink: 0 }}
                  >
                    {dayjs(task.due_date).format('MMM D')}
                  </Badge>
                )}
              </Group>
              <Group gap={4} wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  aria-label="Edit task"
                  onClick={() => setEditingTask(task)}
                >
                  <Pencil size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Delete task"
                  onClick={async () => {
                    await deleteTask(project.id, task.id);
                    refresh();
                  }}
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </Group>
            </Group>
            <Subtasks taskId={task.id} />
          </Paper>
        ))}
        {!tasks.length && <Text c="dimmed">No tasks yet</Text>}
        {tasks.length > 0 && !visibleTasks.length && (
          <Text c="dimmed">No tasks match this filter</Text>
        )}
      </Stack>

      <TaskEditModal
        project={project}
        task={editingTask}
        opened={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSaved={refresh}
      />
    </Stack>
  );
}
