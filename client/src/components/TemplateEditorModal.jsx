import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2 } from 'lucide-react';
import { createTemplate, getTemplate, updateTemplate } from '../api.js';
import { PRIORITY_OPTIONS } from '../priority.js';

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

// Stable local keys for editing rows (module/task ids aren't stable across saves).
let seq = 0;
const nextKey = () => `k${(seq += 1)}`;

// Create a blank template (templateId null) or edit an existing one. The whole
// structure is edited locally and saved in one PATCH/POST (server rebuilds it).
export default function TemplateEditorModal({ opened, templateId, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened) return;
    setError(null);
    if (!templateId) {
      setName('');
      setDescription('');
      setModules([]);
      return;
    }
    setLoading(true);
    getTemplate(templateId)
      .then((t) => {
        setName(t.name);
        setDescription(t.description ?? '');
        setModules(
          (t.modules ?? []).map((m) => ({
            key: nextKey(),
            name: m.name,
            tasks: (m.tasks ?? []).map((task) => ({
              key: nextKey(),
              title: task.title,
              status: task.status,
              priority: task.priority ?? 0,
              notes: task.notes ?? null,
            })),
          })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [opened, templateId]);

  const addModule = () => setModules((ms) => [...ms, { key: nextKey(), name: '', tasks: [] }]);
  const setModuleName = (k, v) =>
    setModules((ms) => ms.map((m) => (m.key === k ? { ...m, name: v } : m)));
  const removeModule = (k) => setModules((ms) => ms.filter((m) => m.key !== k));
  const addTask = (mk) =>
    setModules((ms) =>
      ms.map((m) =>
        m.key === mk
          ? {
              ...m,
              tasks: [
                ...m.tasks,
                { key: nextKey(), title: '', status: 'todo', priority: 0, notes: null },
              ],
            }
          : m,
      ),
    );
  const setTask = (mk, tk, patch) =>
    setModules((ms) =>
      ms.map((m) =>
        m.key === mk
          ? { ...m, tasks: m.tasks.map((t) => (t.key === tk ? { ...t, ...patch } : t)) }
          : m,
      ),
    );
  const removeTask = (mk, tk) =>
    setModules((ms) =>
      ms.map((m) => (m.key === mk ? { ...m, tasks: m.tasks.filter((t) => t.key !== tk) } : m)),
    );

  async function save(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Template name is required');
      return;
    }
    const payloadModules = modules
      .map((m) => ({
        name: m.name.trim(),
        tasks: m.tasks
          .filter((t) => t.title.trim())
          .map((t) => ({
            title: t.title.trim(),
            status: t.status,
            priority: t.priority,
            notes: t.notes,
          })),
      }))
      .filter((m) => m.name);

    setSaving(true);
    try {
      const body = {
        name: trimmed,
        description: description.trim() || null,
        modules: payloadModules,
      };
      const saved = templateId
        ? await updateTemplate(templateId, body)
        : await createTemplate(body);
      notifications.show({
        message: templateId ? 'Template updated' : 'Template created',
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
      title={templateId ? 'Edit template' : 'New template'}
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
            <Textarea
              label="Description"
              placeholder="What is this template for?"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              autosize
              minRows={1}
            />

            <Divider label="Modules (become sections)" labelPosition="left" />

            <ScrollArea.Autosize mah={380} type="auto" offsetScrollbars>
              <Stack gap="sm">
                {modules.map((m) => (
                  <Paper key={m.key} withBorder p="sm" radius="md" bg="dark.7">
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        placeholder="Module name"
                        value={m.name}
                        onChange={(e) => setModuleName(m.key, e.currentTarget.value)}
                        style={{ flex: 1 }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Delete module"
                        onClick={() => removeModule(m.key)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>

                    <Stack gap={6} mt="xs" pl="xs">
                      {m.tasks.map((t) => (
                        <Group key={t.key} gap="xs" wrap="nowrap">
                          <TextInput
                            size="xs"
                            placeholder="Task title"
                            value={t.title}
                            onChange={(e) =>
                              setTask(m.key, t.key, { title: e.currentTarget.value })
                            }
                            style={{ flex: 1 }}
                          />
                          <Select
                            size="xs"
                            w={100}
                            data={STATUS_OPTIONS}
                            value={t.status}
                            onChange={(v) => setTask(m.key, t.key, { status: v ?? 'todo' })}
                            allowDeselect={false}
                          />
                          <Select
                            size="xs"
                            w={110}
                            aria-label="Priority"
                            data={PRIORITY_OPTIONS}
                            value={String(t.priority)}
                            onChange={(v) => setTask(m.key, t.key, { priority: Number(v ?? 0) })}
                            allowDeselect={false}
                          />
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            aria-label="Delete module task"
                            onClick={() => removeTask(m.key, t.key)}
                          >
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Group>
                      ))}
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<Plus size={13} />}
                        onClick={() => addTask(m.key)}
                        style={{ alignSelf: 'flex-start' }}
                      >
                        Add task
                      </Button>
                    </Stack>
                  </Paper>
                ))}

                {modules.length === 0 && (
                  <Text size="sm" c="dark.2">
                    No modules yet — add one below.
                  </Text>
                )}
              </Stack>
            </ScrollArea.Autosize>

            <Button
              variant="light"
              leftSection={<Plus size={15} />}
              onClick={addModule}
              style={{ alignSelf: 'flex-start' }}
            >
              Add module
            </Button>

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
                Save template
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
