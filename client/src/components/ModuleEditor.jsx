import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeft } from 'lucide-react';
import { createModule, getModule, updateModule } from '../api.js';
import LabelPicker from './LabelPicker.jsx';
import BlueprintTasksEditor from './BlueprintTasksEditor.jsx';

// Full-page module editor. A module is a reusable, label-tagged bundle of tasks
// injected into template sections whose label slots match. Saved in one POST/PATCH.
export default function ModuleEditor({ moduleId, onBack, onSaved }) {
  const [name, setName] = useState('');
  const [labelIds, setLabelIds] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setError(null);
    if (!moduleId) {
      setName('');
      setLabelIds([]);
      setTasks([]);
      return;
    }
    setLoading(true);
    getModule(moduleId)
      .then((m) => {
        setName(m.name);
        setLabelIds((m.labels ?? []).map((l) => l.id));
        setTasks(
          (m.tasks ?? []).map((t) => ({
            title: t.title,
            status: t.status ?? 'todo',
            priority: t.priority ?? 0,
            subtasks: t.subtasks ?? [],
          })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [moduleId]);

  async function save(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Module name is required');
      return;
    }
    const payloadTasks = tasks
      .filter((t) => t.title.trim())
      .map((t) => ({
        title: t.title.trim(),
        status: t.status,
        priority: t.priority,
        subtasks: (t.subtasks ?? []).map((s) => s.trim()).filter(Boolean),
      }));

    setSaving(true);
    try {
      const body = { name: trimmed, labelIds, tasks: payloadTasks };
      const saved = moduleId ? await updateModule(moduleId, body) : await createModule(body);
      notifications.show({
        message: moduleId ? 'Module updated' : 'Module created',
        color: 'teal',
      });
      onSaved?.(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <ActionIcon variant="subtle" color="gray" aria-label="Back to modules" onClick={onBack}>
            <ArrowLeft size={18} />
          </ActionIcon>
          <Text fw={700} fz="xl">
            {moduleId ? 'Edit module' : 'New module'}
          </Text>
        </Group>
        <Button onClick={save} loading={saving}>
          Save module
        </Button>
      </Group>

      {loading ? (
        <Group justify="center" py="xl">
          <Loader color="teal" />
        </Group>
      ) : (
        <form onSubmit={save}>
          <Stack maw={860}>
            <TextInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              data-autofocus
            />
            <LabelPicker value={labelIds} onChange={setLabelIds} />
            <Divider label="Tasks" labelPosition="left" mt="sm" />
            <BlueprintTasksEditor tasks={tasks} onChange={setTasks} />

            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
          </Stack>
        </form>
      )}
    </>
  );
}
