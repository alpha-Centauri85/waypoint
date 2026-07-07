import { useEffect, useState } from 'react';
import { Alert, Button, Divider, Group, Loader, Modal, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createModule, getModule, updateModule } from '../api.js';
import LabelPicker from './LabelPicker.jsx';
import BlueprintTasksEditor from './BlueprintTasksEditor.jsx';

// Create a blank library module (moduleId null) or edit an existing one. A module
// is a reusable, label-tagged bundle of tasks injected into template sections
// whose label slots match. Edited locally and saved in one POST/PATCH.
export default function ModuleEditorModal({ opened, moduleId, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [labelIds, setLabelIds] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened) return;
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
  }, [opened, moduleId]);

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
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={moduleId ? 'Edit module' : 'New module'}
      size="lg"
      centered
    >
      {loading ? (
        <Group justify="center" py="lg">
          <Loader color="teal" />
        </Group>
      ) : (
        <form onSubmit={save}>
          <Stack>
            <TextInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              data-autofocus
            />
            <LabelPicker value={labelIds} onChange={setLabelIds} />
            <Divider label="Tasks" labelPosition="left" />
            <BlueprintTasksEditor tasks={tasks} onChange={setTasks} />

            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button type="button" variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Save module
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
