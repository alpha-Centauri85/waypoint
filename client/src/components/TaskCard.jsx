import { ActionIcon, Badge, Group, Paper, Text, Tooltip } from '@mantine/core';
import { CalendarClock, FileText, Flag, GripVertical, Pencil, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';
import { PRIORITY_META } from '../priority.js';
import Subtasks from './Subtasks.jsx';

const STATUS_COLOR = { todo: 'gray', doing: 'amber', done: 'teal' };
const STATUS_LABEL = { todo: 'To do', doing: 'In progress', done: 'Done' };

// A task is overdue when its due date is in the past and it isn't done yet.
export function isOverdue(task) {
  return task.due_date && task.status !== 'done' && dayjs(task.due_date).isBefore(dayjs(), 'day');
}

// One task row: status pill (click to cycle), title, priority/notes/due/label
// meta, edit + delete, and its subtasks. Drag behaviour is driven by the parent
// via `drag` (handlers + dragging/dragOver flags) so reordering can be scoped.
export default function TaskCard({ task, reorderEnabled, drag, onCycle, onEdit, onDelete }) {
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
          <Tooltip label="Click to change status" openDelay={400}>
            <Badge
              color={STATUS_COLOR[task.status]}
              variant={task.status === 'todo' ? 'light' : 'filled'}
              w={92}
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={onCycle}
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
          {(task.labels ?? []).map((label) => (
            <Badge key={label.id} variant="dot" color={label.color} style={{ flexShrink: 0 }}>
              {label.name}
            </Badge>
          ))}
        </Group>
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="subtle" aria-label="Edit task" onClick={onEdit}>
            <Pencil size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" aria-label="Delete task" onClick={onDelete}>
            <Trash2 size={16} />
          </ActionIcon>
        </Group>
      </Group>
      <Subtasks taskId={task.id} />
    </Paper>
  );
}
