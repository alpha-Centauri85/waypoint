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
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2 } from 'lucide-react';
import { createTemplate, getTemplate, updateTemplate } from '../api.js';
import LabelPicker from './LabelPicker.jsx';
import BlueprintTasksEditor from './BlueprintTasksEditor.jsx';

// Stable local keys for editing rows (section ids aren't stable across saves).
let seq = 0;
const nextKey = () => `k${(seq += 1)}`;

// Create a blank template (templateId null) or edit an existing one. A template is
// an ordered set of sections; each has fixed tasks (with subtasks) plus label
// "slots" — on instantiate, library modules matching a slot are injected there.
// Edited locally and saved in one PATCH/POST (server rebuilds the structure).
export default function TemplateEditorModal({ opened, templateId, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opened) return;
    setError(null);
    if (!templateId) {
      setName('');
      setDescription('');
      setSections([]);
      return;
    }
    setLoading(true);
    getTemplate(templateId)
      .then((t) => {
        setName(t.name);
        setDescription(t.description ?? '');
        setSections(
          (t.sections ?? []).map((s) => ({
            key: nextKey(),
            name: s.name,
            labelIds: s.labelIds ?? [],
            tasks: (s.tasks ?? []).map((task) => ({
              title: task.title,
              status: task.status ?? 'todo',
              priority: task.priority ?? 0,
              subtasks: task.subtasks ?? [],
            })),
          })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [opened, templateId]);

  const addSection = () =>
    setSections((ss) => [...ss, { key: nextKey(), name: '', labelIds: [], tasks: [] }]);
  const setSection = (k, patch) =>
    setSections((ss) => ss.map((s) => (s.key === k ? { ...s, ...patch } : s)));
  const removeSection = (k) => setSections((ss) => ss.filter((s) => s.key !== k));

  async function save(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Template name is required');
      return;
    }
    const payloadSections = sections
      .map((s) => ({
        name: s.name.trim(),
        labelIds: s.labelIds,
        tasks: s.tasks
          .filter((t) => t.title.trim())
          .map((t) => ({
            title: t.title.trim(),
            status: t.status,
            priority: t.priority,
            subtasks: (t.subtasks ?? []).map((x) => x.trim()).filter(Boolean),
          })),
      }))
      .filter((s) => s.name);

    setSaving(true);
    try {
      const body = {
        name: trimmed,
        description: description.trim() || null,
        sections: payloadSections,
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

            <Divider label="Sections" labelPosition="left" />

            <ScrollArea.Autosize mah={420} type="auto" offsetScrollbars>
              <Stack gap="sm">
                {sections.map((s) => (
                  <Paper key={s.key} withBorder p="sm" radius="md" bg="dark.7">
                    <Group gap="xs" wrap="nowrap" mb="xs">
                      <TextInput
                        placeholder="Section name"
                        value={s.name}
                        onChange={(e) => setSection(s.key, { name: e.currentTarget.value })}
                        style={{ flex: 1 }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Delete section"
                        onClick={() => removeSection(s.key)}
                      >
                        <Trash2 size={16} />
                      </ActionIcon>
                    </Group>

                    <LabelPicker
                      label="Label slots (pull in matching modules)"
                      value={s.labelIds}
                      onChange={(ids) => setSection(s.key, { labelIds: ids })}
                    />

                    <Text size="xs" c="dark.2" mt="sm" mb={4}>
                      Fixed tasks
                    </Text>
                    <BlueprintTasksEditor
                      tasks={s.tasks}
                      onChange={(tasks) => setSection(s.key, { tasks })}
                    />
                  </Paper>
                ))}

                {sections.length === 0 && (
                  <Text size="sm" c="dark.2">
                    No sections yet — add one below.
                  </Text>
                )}
              </Stack>
            </ScrollArea.Autosize>

            <Button
              variant="light"
              leftSection={<Plus size={15} />}
              onClick={addSection}
              style={{ alignSelf: 'flex-start' }}
            >
              Add section
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
