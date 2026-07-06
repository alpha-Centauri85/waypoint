import { useState } from 'react';
import { Badge, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { CalendarClock, FileText, Flag } from 'lucide-react';
import dayjs from 'dayjs';
import { PRIORITY_META } from '../priority.js';
import { isOverdue } from './TaskCard.jsx';

// Kanban columns are the task statuses; dragging a card to a column sets that
// status. Cards are compact and open the edit modal on click.
const COLUMNS = [
  { status: 'todo', label: 'To do', color: 'gray' },
  { status: 'doing', label: 'In progress', color: 'amber' },
  { status: 'done', label: 'Done', color: 'teal' },
];

export default function TaskBoard({ tasks, onChangeStatus, onEditTask }) {
  const [draggedId, setDraggedId] = useState(null);
  const [overStatus, setOverStatus] = useState(null);

  function drop(status) {
    const dragged = tasks.find((t) => t.id === draggedId);
    setDraggedId(null);
    setOverStatus(null);
    if (dragged && dragged.status !== status) onChangeStatus(dragged, status);
  }

  return (
    <Group align="flex-start" gap="md" wrap="nowrap" style={{ overflowX: 'auto' }}>
      {COLUMNS.map((col) => {
        const items = tasks.filter((t) => t.status === col.status);
        return (
          <Stack
            key={col.status}
            gap="sm"
            aria-label={`${col.label} column`}
            onDragOver={(e) => {
              if (draggedId === null) return;
              e.preventDefault();
              if (overStatus !== col.status) setOverStatus(col.status);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(col.status);
            }}
            style={{
              flex: '1 1 0',
              minWidth: 250,
              background: 'var(--mantine-color-dark-7)',
              borderRadius: 12,
              padding: 10,
              outline:
                overStatus === col.status
                  ? '2px dashed var(--mantine-color-teal-7)'
                  : '1px solid var(--mantine-color-dark-4)',
            }}
          >
            <Group justify="space-between" px={4} pb={2}>
              <Badge
                color={col.color}
                variant={col.status === 'todo' ? 'light' : 'filled'}
                radius="sm"
              >
                {col.label}
              </Badge>
              <Text size="sm" c="dark.2" fw={600}>
                {items.length}
              </Text>
            </Group>

            {items.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                dragging={draggedId === task.id}
                onDragStart={() => setDraggedId(task.id)}
                onDragEnd={() => {
                  setDraggedId(null);
                  setOverStatus(null);
                }}
                onClick={() => onEditTask(task)}
              />
            ))}

            {!items.length && (
              <Text size="xs" c="dark.3" ta="center" py="md">
                Drop tasks here
              </Text>
            )}
          </Stack>
        );
      })}
    </Group>
  );
}

function BoardCard({ task, dragging, onDragStart, onDragEnd, onClick }) {
  const hasMeta =
    task.priority > 0 || task.due_date || (task.labels ?? []).length > 0 || task.notes;
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      bg="dark.6"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{ cursor: 'grab', opacity: dragging ? 0.4 : 1 }}
    >
      <Text size="sm">{task.title}</Text>
      {hasMeta && (
        <Group gap={6} mt={8}>
          {task.priority > 0 && (
            <Tooltip label={`${PRIORITY_META[task.priority].label} priority`}>
              <Flag
                size={13}
                style={{
                  color: `var(--mantine-color-${PRIORITY_META[task.priority].color}-5)`,
                  fill: `var(--mantine-color-${PRIORITY_META[task.priority].color}-5)`,
                }}
              />
            </Tooltip>
          )}
          {task.notes && <FileText size={13} style={{ opacity: 0.6 }} />}
          {task.due_date && (
            <Badge
              size="xs"
              variant="light"
              color={isOverdue(task) ? 'red' : 'gray'}
              leftSection={<CalendarClock size={10} />}
            >
              {dayjs(task.due_date).format('MMM D')}
            </Badge>
          )}
          {(task.labels ?? []).map((label) => (
            <Badge key={label.id} size="xs" variant="dot" color={label.color}>
              {label.name}
            </Badge>
          ))}
        </Group>
      )}
    </Paper>
  );
}
