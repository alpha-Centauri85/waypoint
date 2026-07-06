import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  Progress,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  ArrowUpDown,
  CalendarClock,
  FileText,
  Flag,
  GripVertical,
  Pencil,
  Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { createTask, deleteTask, listTasks, reorderTasks, updateTask } from '../api.js';
import { notifyError } from '../notify.js';
import { PRIORITY_META } from '../priority.js';
import Subtasks from './Subtasks.jsx';
import TaskEditModal from './TaskEditModal.jsx';

const STATUSES = ['todo', 'doing', 'done'];
const STATUS_COLOR = { todo: 'gray', doing: 'amber', done: 'teal' };
const STATUS_LABEL = { todo: 'To do', doing: 'In progress', done: 'Done' };

const STATUS_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'To do', value: 'todo' },
  { label: 'Doing', value: 'doing' },
  { label: 'Done', value: 'done' },
];

const SORT_OPTIONS = [
  { value: 'default', label: 'Manual order' },
  { value: 'priority', label: 'Priority' },
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
  } else if (sortBy === 'priority') {
    sorted.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0)); // urgent first
  } else if (sortBy === 'status') {
    sorted.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
  } else if (sortBy === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }
  return sorted;
}

// Move the task with `draggedId` to the position of `targetId`, returning a new
// array (the original is untouched). Exported for tests.
export function moveTask(tasks, draggedId, targetId) {
  if (draggedId === targetId) return tasks;
  const from = tasks.findIndex((t) => t.id === draggedId);
  const to = tasks.findIndex((t) => t.id === targetId);
  if (from === -1 || to === -1) return tasks;
  const next = [...tasks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export default function TaskList({ project, onTasksChanged }) {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [loading, setLoading] = useState(true);

  const visibleTasks = useMemo(
    () => arrangeTasks(tasks, statusFilter, sortBy),
    [tasks, statusFilter, sortBy],
  );

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  // Reordering only makes sense when the list reflects the stored manual order
  // (no filter hiding rows, no other sort overriding it).
  const reorderEnabled = statusFilter === 'all' && sortBy === 'default';

  async function refresh() {
    try {
      setTasks(await listTasks(project.id));
    } catch (err) {
      notifyError(err, 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }

  // Refetch tasks and let the parent refresh its per-project progress rollups.
  async function refreshAll() {
    await refresh();
    onTasksChanged?.();
  }

  function handleDrop(targetId) {
    const next = moveTask(tasks, draggedId, targetId);
    setDraggedId(null);
    setDragOverId(null);
    if (next === tasks) return;
    setTasks(next); // optimistic; revert by refetching if the server rejects it
    reorderTasks(
      project.id,
      next.map((t) => t.id),
    ).catch((err) => {
      notifyError(err, 'Could not reorder tasks');
      refresh();
    });
  }

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    try {
      await createTask(project.id, title);
      setNewTitle('');
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not add task');
    }
  }

  async function cycleStatus(task) {
    const next = STATUSES[(STATUSES.indexOf(task.status) + 1) % STATUSES.length];
    try {
      await updateTask(project.id, task.id, { status: next });
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not update task');
    }
  }

  async function handleDelete(task) {
    try {
      await deleteTask(project.id, task.id);
      refreshAll();
    } catch (err) {
      notifyError(err, 'Could not delete task');
    }
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <div>
          <Title order={2}>{project.name}</Title>
          {project.description && (
            <Text c="dark.2" mt={4}>
              {project.description}
            </Text>
          )}
        </div>
        {tasks.length > 0 && (
          <Stack gap={4} w={180} style={{ flexShrink: 0 }}>
            <Group justify="space-between" gap="xs">
              <Text size="xs" c="dark.2">
                {doneCount} of {tasks.length} done
              </Text>
              <Text size="xs" fw={600} c={pct === 100 ? 'teal.4' : 'dark.1'}>
                {pct}%
              </Text>
            </Group>
            <Progress value={pct} color={pct === 100 ? 'teal' : 'amber'} size="md" radius="xl" />
          </Stack>
        )}
      </Group>

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
        {loading &&
          [0, 1, 2].map((i) => (
            <Paper key={`sk-${i}`} withBorder p="sm" radius="md" style={{ opacity: 0.5 }}>
              <Center h={28}>{i === 0 ? <Loader size="sm" color="teal" /> : null}</Center>
            </Paper>
          ))}
        {!loading &&
          visibleTasks.map((task) => (
            <Paper
              key={task.id}
              withBorder
              p="sm"
              radius="md"
              draggable={reorderEnabled}
              onDragStart={() => setDraggedId(task.id)}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (!reorderEnabled || draggedId === null) return;
                e.preventDefault();
                if (dragOverId !== task.id) setDragOverId(task.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(task.id);
              }}
              style={{
                opacity: draggedId === task.id ? 0.4 : 1,
                borderTop:
                  dragOverId === task.id && draggedId !== task.id
                    ? '2px solid var(--mantine-primary-color-filled)'
                    : undefined,
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  {reorderEnabled && (
                    <Tooltip label="Drag to reorder" openDelay={400}>
                      <GripVertical
                        size={16}
                        aria-label="Drag handle"
                        style={{ cursor: 'grab', flexShrink: 0, opacity: 0.5 }}
                      />
                    </Tooltip>
                  )}
                  <Tooltip label="Click to change status" openDelay={400}>
                    <Badge
                      color={STATUS_COLOR[task.status]}
                      variant={task.status === 'todo' ? 'light' : 'filled'}
                      w={92}
                      style={{ cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => cycleStatus(task)}
                    >
                      {STATUS_LABEL[task.status]}
                    </Badge>
                  </Tooltip>
                  <Text truncate>{task.title}</Text>
                  {task.priority > 0 && (
                    <Tooltip label={`${PRIORITY_META[task.priority].label} priority`}>
                      <Flag
                        size={14}
                        style={{
                          flexShrink: 0,
                          color: `var(--mantine-color-${PRIORITY_META[task.priority].color}-5)`,
                          fill: `var(--mantine-color-${PRIORITY_META[task.priority].color}-5)`,
                        }}
                      />
                    </Tooltip>
                  )}
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
                    onClick={() => handleDelete(task)}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
              </Group>
              <Subtasks taskId={task.id} />
            </Paper>
          ))}
        {!loading && !tasks.length && (
          <Text c="dark.2" py="sm">
            No tasks yet — add your first one above.
          </Text>
        )}
        {!loading && tasks.length > 0 && !visibleTasks.length && (
          <Text c="dark.2" py="sm">
            No tasks match this filter.
          </Text>
        )}
      </Stack>

      <TaskEditModal
        project={project}
        task={editingTask}
        opened={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSaved={refreshAll}
      />
    </Stack>
  );
}
