import { useEffect, useState } from 'react';
import { ActionIcon, Checkbox, Group, Stack, Text, TextInput } from '@mantine/core';
import { Plus, Trash2 } from 'lucide-react';
import { createSubtask, deleteSubtask, listSubtasks, updateSubtask } from '../api.js';

export default function Subtasks({ taskId }) {
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  async function refresh() {
    setSubtasks(await listSubtasks(taskId));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    await createSubtask(taskId, title);
    setNewTitle('');
    refresh();
  }

  async function toggle(subtask) {
    await updateSubtask(taskId, subtask.id, { done: !subtask.done });
    refresh();
  }

  return (
    <Stack gap={4} mt="xs" ml="lg">
      {subtasks.map((s) => (
        <Group key={s.id} justify="space-between" gap="xs" wrap="nowrap">
          <Checkbox
            checked={!!s.done}
            onChange={() => toggle(s)}
            label={
              <Text td={s.done ? 'line-through' : undefined} c={s.done ? 'dimmed' : undefined}>
                {s.title}
              </Text>
            }
          />
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            aria-label="Delete subtask"
            onClick={async () => {
              await deleteSubtask(taskId, s.id);
              refresh();
            }}
          >
            <Trash2 size={14} />
          </ActionIcon>
        </Group>
      ))}
      <form onSubmit={handleCreate}>
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="Add subtask"
            value={newTitle}
            onChange={(e) => setNewTitle(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <ActionIcon type="submit" size="md" variant="light" aria-label="Add subtask">
            <Plus size={14} />
          </ActionIcon>
        </Group>
      </form>
    </Stack>
  );
}
