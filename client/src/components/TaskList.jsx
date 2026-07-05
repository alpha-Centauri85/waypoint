import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { CalendarClock, FileText, Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { createTask, deleteTask, listTasks, updateTask } from '../api.js';
import Subtasks from './Subtasks.jsx';
import TaskEditModal from './TaskEditModal.jsx';

const STATUSES = ['todo', 'doing', 'done'];
const STATUS_COLOR = { todo: 'gray', doing: 'blue', done: 'green' };

// A task is overdue when its due date is in the past and it isn't done yet.
function isOverdue(task) {
  return task.due_date && task.status !== 'done' && dayjs(task.due_date).isBefore(dayjs(), 'day');
}

export default function TaskList({ project }) {
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [editingTask, setEditingTask] = useState(null);

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

      <Stack gap="sm">
        {tasks.map((task) => (
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
