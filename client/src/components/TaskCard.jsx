import { ActionIcon, Badge, Group, Paper, Text, Tooltip } from '@mantine/core';
import { CalendarClock, FileText, Flag, GripVertical, Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { PRIORITY_META } from '../priority.js';
import { useStatuses } from '../statuses.jsx';
import StatusPicker from './StatusPicker.jsx';
import Subtasks from './Subtasks.jsx';

// A task is overdue when its due date is in the past and its status isn't terminal.
export function isOverdue(task, isDone) {
  return task.due_date && !isDone && dayjs(task.due_date).isBefore(dayjs(), 'day');
}

// One task row: status pill (click to pick a status), title, priority/notes/due/
// label meta, edit + delete, and its subtasks. Drag behaviour is driven by the
// parent via `drag` (handlers + dragging/dragOver flags) so reordering can be scoped.
export default function TaskCard({
  task,
  reorderEnabled,
  drag,
  onSetStatus,
  onEdit,
  onDelete,
  canEdit = true,
}) {
  const { statusById } = useStatuses();
  const status = statusById(task.status_id);
  return (
    <Paper
      withBorder
      p="sm"
      radius="md"
      draggable={reorderEnabled}
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
      onDragOver={drag.onDragOver}
      onDrop={drag.onDrop}
      style={{
        opacity: drag.dragging ? 0.4 : 1,
        borderTop: drag.dragOver ? '2px solid var(--mantine-primary-color-filled)' : undefined,
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
          <StatusPicker statusId={task.status_id} onChange={onSetStatus} canEdit={canEdit} />
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
              color={isOverdue(task, status.is_done) ? 'red' : 'gray'}
              leftSection={<CalendarClock size={12} />}
              style={{ flexShrink: 0 }}
            >
              {dayjs(task.due_date).format('MMM D')}
            </Badge>
          )}
          {(task.labels ?? []).map((label) => (
            <Badge key={label.id} variant="dot" color={label.color} style={{ flexShrink: 0 }}>
              {label.name}
            </Badge>
          ))}
        </Group>
        {canEdit && (
          <Group gap={4} wrap="nowrap">
            <ActionIcon variant="subtle" aria-label="Edit task" onClick={onEdit}>
              <Pencil size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="red" aria-label="Delete task" onClick={onDelete}>
              <Trash2 size={16} />
            </ActionIcon>
          </Group>
        )}
      </Group>
      <Subtasks taskId={task.id} canEdit={canEdit} />
    </Paper>
  );
}
