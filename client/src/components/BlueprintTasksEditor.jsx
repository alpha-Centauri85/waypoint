import { ActionIcon, Button, Group, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { Plus, Trash2 } from 'lucide-react';
import { PRIORITY_OPTIONS } from '../priority.js';

// Blueprint statuses are keys mapped to the user's workflow on instantiate.
const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

// Edits an array of blueprint tasks — used by the module editor and each
// template section. A task is { title, status, priority, subtasks: [title] }.
// Subtasks are edited as one-per-line text to keep the UI compact.
export default function BlueprintTasksEditor({ tasks, onChange }) {
  const setTask = (i, patch) => onChange(tasks.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const removeTask = (i) => onChange(tasks.filter((_, j) => j !== i));
  const addTask = () =>
    onChange([...tasks, { title: '', status: 'todo', priority: 0, subtasks: [] }]);

  return (
    <Stack gap="xs">
      {tasks.map((t, i) => (
        <Stack key={i} gap={4}>
          <Group gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              placeholder="Task title"
              value={t.title}
              onChange={(e) => setTask(i, { title: e.currentTarget.value })}
              style={{ flex: 1 }}
            />
            <Select
              size="xs"
              w={100}
              data={STATUS_OPTIONS}
              value={t.status ?? 'todo'}
              onChange={(v) => setTask(i, { status: v ?? 'todo' })}
              allowDeselect={false}
            />
            <Select
              size="xs"
              w={110}
              aria-label="Priority"
              data={PRIORITY_OPTIONS}
              value={String(t.priority ?? 0)}
              onChange={(v) => setTask(i, { priority: Number(v ?? 0) })}
              allowDeselect={false}
            />
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              aria-label="Delete task"
              onClick={() => removeTask(i)}
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Group>
          <Textarea
            size="xs"
            ml="xs"
            placeholder="Subtasks, one per line"
            autosize
            minRows={1}
            value={(t.subtasks ?? []).join('\n')}
            onChange={(e) => setTask(i, { subtasks: e.currentTarget.value.split('\n') })}
          />
        </Stack>
      ))}
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        leftSection={<Plus size={13} />}
        onClick={addTask}
        style={{ alignSelf: 'flex-start' }}
      >
        Add task
      </Button>
    </Stack>
  );
}
