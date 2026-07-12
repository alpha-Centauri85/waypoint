import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { LayoutTemplate, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { deleteTemplate, listTemplates } from '../api.js';
import { notifyError } from '../notify.js';
import TemplateEditor from './TemplateEditor.jsx';
import InstantiateTemplateModal from './InstantiateTemplateModal.jsx';

// Full page for managing templates: a list, with a full-width editor that opens
// in place. `onInstantiated(project)` bubbles a newly created project up so the
// app can jump to it. Editing is a view state: null = list, 'new' or an id = edit.
export default function TemplatesPage({ onInstantiated }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [useId, setUseId] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      setTemplates(await listTemplates());
    } catch (err) {
      notifyError(err, 'Could not load templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function remove(t) {
    try {
      await deleteTemplate(t.id);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete template');
    }
  }

  if (editing !== null) {
    return (
      <TemplateEditor
        templateId={editing === 'new' ? null : editing}
        onBack={() => setEditing(null)}
        onSaved={(saved) => {
          refresh();
          if (editing === 'new' && saved?.id) setEditing(saved.id);
        }}
        onInstantiated={onInstantiated}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Templates</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setEditing('new')}>
          New template
        </Button>
      </Group>

      {loading ? (
        <Group justify="center" py="xl">
          <Loader color="teal" />
        </Group>
      ) : templates.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <LayoutTemplate size={40} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed" ta="center">
            No templates yet. Create one, or open a project and choose <b>Save as template</b>.
          </Text>
        </Stack>
      ) : (
        <Stack gap="xs">
          {templates.map((t) => (
            <Paper key={t.id} withBorder p="md" radius="md">
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {t.name}
                  </Text>
                  <Group gap={6} mt={4}>
                    <Badge size="xs" variant="light" color="gray">
                      {t.section_count} {t.section_count === 1 ? 'section' : 'sections'}
                    </Badge>
                    <Badge size="xs" variant="light" color="gray">
                      {t.task_count} {t.task_count === 1 ? 'task' : 'tasks'}
                    </Badge>
                  </Group>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <Button size="xs" leftSection={<Play size={13} />} onClick={() => setUseId(t.id)}>
                    Use
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label="Edit template"
                    onClick={() => setEditing(t.id)}
                  >
                    <Pencil size={15} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Delete template"
                    onClick={() => remove(t)}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <InstantiateTemplateModal
        opened={useId !== null}
        templateId={useId}
        onClose={() => setUseId(null)}
        onInstantiated={(project) => {
          setUseId(null);
          onInstantiated?.(project);
        }}
      />
    </>
  );
}
