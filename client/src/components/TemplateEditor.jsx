import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, Play, Plus, Trash2 } from 'lucide-react';
import { createTemplate, getTemplate, updateTemplate } from '../api.js';
import LabelPicker from './LabelPicker.jsx';
import BlueprintTasksEditor from './BlueprintTasksEditor.jsx';
import InstantiateTemplateModal from './InstantiateTemplateModal.jsx';

// Stable local keys for editing rows (section ids aren't stable across saves).
let seq = 0;
const nextKey = () => `k${(seq += 1)}`;

// Full-page template editor (blank when templateId is null, else edits an
// existing one). A template is an ordered set of sections; each has fixed tasks
// (standard) and/or label "slots" (module-based) — at project creation, modules
// matching a section's labels are injected. Saved in one POST/PATCH.
export default function TemplateEditor({ templateId, onBack, onSaved, onInstantiated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [instantiateId, setInstantiateId] = useState(null);

  useEffect(() => {
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
  }, [templateId]);

  const addSection = () =>
    setSections((ss) => [...ss, { key: nextKey(), name: '', labelIds: [], tasks: [] }]);
  const setSection = (k, patch) =>
    setSections((ss) => ss.map((s) => (s.key === k ? { ...s, ...patch } : s)));
  const removeSection = (k) => setSections((ss) => ss.filter((s) => s.key !== k));

  // Persist; returns the saved template (with id) or null. Doesn't navigate.
  async function persist() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Template name is required');
      return null;
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
      onSaved?.(saved);
      return saved;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const saved = await persist();
    if (saved)
      notifications.show({
        message: templateId ? 'Template updated' : 'Template created',
        color: 'teal',
      });
  }

  async function saveAndStart() {
    setError(null);
    const saved = await persist();
    if (saved) setInstantiateId(saved.id);
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <ActionIcon variant="subtle" color="gray" aria-label="Back to templates" onClick={onBack}>
            <ArrowLeft size={18} />
          </ActionIcon>
          <Text fw={700} fz="xl">
            {templateId ? 'Edit template' : 'New template'}
          </Text>
        </Group>
        <Group gap="xs">
          <Button
            variant="light"
            color="teal"
            leftSection={<Play size={15} />}
            onClick={saveAndStart}
            loading={saving}
          >
            Save &amp; start project
          </Button>
          <Button onClick={save} loading={saving}>
            Save template
          </Button>
        </Group>
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
            <Textarea
              label="Description"
              placeholder="What is this template for?"
              value={description}
              onChange={(e) => setDescription(e.currentTarget.value)}
              autosize
              minRows={1}
            />

            <Divider label="Sections" labelPosition="left" mt="sm" />

            <Stack gap="md">
              {sections.map((s) => (
                <Paper
                  key={s.key}
                  withBorder
                  p="md"
                  radius="md"
                  bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
                >
                  <Group gap="xs" wrap="nowrap" mb="sm">
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
                    label="Label slots (module-based: pull in matching modules)"
                    value={s.labelIds}
                    onChange={(ids) => setSection(s.key, { labelIds: ids })}
                  />

                  <Text size="xs" c="dimmed" mt="md" mb={4}>
                    Fixed tasks
                  </Text>
                  <BlueprintTasksEditor
                    tasks={s.tasks}
                    onChange={(tasks) => setSection(s.key, { tasks })}
                  />
                </Paper>
              ))}

              {sections.length === 0 && (
                <Text size="sm" c="dimmed">
                  No sections yet — add one below.
                </Text>
              )}
            </Stack>

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
          </Stack>
        </form>
      )}

      <InstantiateTemplateModal
        opened={instantiateId !== null}
        templateId={instantiateId}
        onClose={() => setInstantiateId(null)}
        onInstantiated={(project) => {
          setInstantiateId(null);
          onInstantiated?.(project);
        }}
      />
    </>
  );
}
