import { useEffect, useState } from 'react';
import { ActionIcon, Group, Stack, Text, TextInput } from '@mantine/core';
import { Plus, Trash2 } from 'lucide-react';
import { createSubtask, deleteSubtask, listSubtasks, updateSubtask } from '../api.js';
import { notifyError } from '../notify.js';
import { useStatuses } from '../statuses.jsx';
import StatusPicker from './StatusPicker.jsx';

export default function Subtasks({ taskId, canEdit = true }) {
  const { statusById } = useStatuses();
  const [subtasks, setSubtasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');

  async function refresh() {
    try {
      setSubtasks(await listSubtasks(taskId));
    } catch (err) {
      notifyError(err, 'Could not load subtasks');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleCreate(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    try {
      await createSubtask(taskId, title);
      setNewTitle('');
      refresh();
    } catch (err) {
      notifyError(err, 'Could not add subtask');
    }
  }

  async function setStatus(subtask, statusId) {
    try {
      await updateSubtask(taskId, subtask.id, { statusId });
      refresh();
    } catch (err) {
      notifyError(err, 'Could not update subtask');
    }
  }

  async function handleDelete(subtask) {
    try {
      await deleteSubtask(taskId, subtask.id);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete subtask');
    }
  }

  // Subtask completion is a local view only (not wired into task/project rollups).
  const doneCount = subtasks.filter((s) => statusById(s.status_id).is_done).length;

  return (
    <Stack gap={4} mt="xs" ml="lg">
      {subtasks.map((s) => {
        const done = statusById(s.status_id).is_done;
        return (
          <Group key={s.id} justify="space-between" gap="xs" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <StatusPicker
                statusId={s.status_id}
                onChange={(statusId) => setStatus(s, statusId)}
                canEdit={canEdit}
                size="sm"
                w={100}
              />
              <Text truncate td={done ? 'line-through' : undefined} c={done ? 'dimmed' : undefined}>
                {s.title}
              </Text>
            </Group>
            {canEdit && (
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                aria-label="Delete subtask"
                onClick={() => handleDelete(s)}
              >
                <Trash2 size={14} />
              </ActionIcon>
            )}
          </Group>
        );
      })}
      {subtasks.length > 0 && (
        <Text size="xs" c="dimmed" ml={4}>
          {doneCount} of {subtasks.length} done
        </Text>
      )}
      {canEdit && (
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
      )}
    </Stack>
  );
}
