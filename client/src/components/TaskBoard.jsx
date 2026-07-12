import { useState } from 'react';
import { Badge, Group, Paper, Stack, Text, Tooltip } from '@mantine/core';
import { CalendarClock, FileText, Flag } from 'lucide-react';
import dayjs from 'dayjs';
import { PRIORITY_META } from '../priority.js';
import { useStatuses } from '../statuses.jsx';
import { isOverdue } from './TaskCard.jsx';

// Kanban columns are the user's workflow statuses; dragging a card to a column
// sets that status. Cards are compact and open the edit modal on click.
export default function TaskBoard({ tasks, onChangeStatus, onEditTask }) {
  const { statuses } = useStatuses();
  const [draggedId, setDraggedId] = useState(null);
  const [overId, setOverId] = useState(null);

  function drop(statusId) {
    const dragged = tasks.find((t) => t.id === draggedId);
    setDraggedId(null);
    setOverId(null);
    if (dragged && dragged.status_id !== statusId) onChangeStatus(dragged, statusId);
  }

  return (
    <Group align="flex-start" gap="md" wrap="nowrap" style={{ overflowX: 'auto' }}>
      {statuses.map((col) => {
        const items = tasks.filter((t) => t.status_id === col.id);
        return (
          <Stack
            key={col.id}
            gap="sm"
            aria-label={`${col.name} column`}
            onDragOver={(e) => {
              if (draggedId === null) return;
              e.preventDefault();
              if (overId !== col.id) setOverId(col.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(col.id);
            }}
            style={{
              flex: '1 1 0',
              minWidth: 240,
              background: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-7))',
              borderRadius: 12,
              padding: 10,
              outline:
                overId === col.id
                  ? '2px dashed var(--mantine-color-teal-7)'
                  : '1px solid var(--mantine-color-default-border)',
            }}
          >
            <Group justify="space-between" px={4} pb={2}>
              <Badge color={col.color} variant={col.is_done ? 'filled' : 'light'} radius="sm">
                {col.name}
              </Badge>
              <Text size="sm" c="dimmed" fw={600}>
                {items.length}
              </Text>
            </Group>

            {items.map((task) => (
              <BoardCard
                key={task.id}
                task={task}
                isDone={col.is_done}
                dragging={draggedId === task.id}
                onDragStart={() => setDraggedId(task.id)}
                onDragEnd={() => {
                  setDraggedId(null);
                  setOverId(null);
                }}
                onClick={() => onEditTask(task)}
              />
            ))}

            {!items.length && (
              <Text size="xs" c="dimmed" ta="center" py="md">
                Drop tasks here
              </Text>
            )}
          </Stack>
        );
      })}
    </Group>
  );
}

function BoardCard({ task, isDone, dragging, onDragStart, onDragEnd, onClick }) {
  const hasMeta =
    task.priority > 0 || task.due_date || (task.labels ?? []).length > 0 || task.notes;
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
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
              color={isOverdue(task, isDone) ? 'red' : 'gray'}
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
