import { useEffect, useState } from 'react';
import { ActionIcon, Badge, Button, Group, Loader, Modal, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { LayoutTemplate, Trash2 } from 'lucide-react';
import { deleteTemplate, instantiateTemplate, listTemplates } from '../api.js';
import { notifyError } from '../notify.js';

// Browse saved templates: start a new project from one, or delete it.
export default function TemplatesModal({ opened, onClose, onInstantiated }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

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
    if (opened) refresh();
  }, [opened]);

  async function startFromTemplate(t) {
    setBusyId(t.id);
    try {
      const project = await instantiateTemplate(t.id, t.name);
      notifications.show({ message: `Created “${project.name}” from template`, color: 'teal' });
      onInstantiated(project);
      onClose();
    } catch (err) {
      notifyError(err, 'Could not create project from template');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t) {
    try {
      await deleteTemplate(t.id);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete template');
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Start from a template" centered>
      {loading ? (
        <Group justify="center" py="lg">
          <Loader color="teal" />
        </Group>
      ) : templates.length === 0 ? (
        <Stack align="center" gap="xs" py="lg">
          <LayoutTemplate size={36} color="var(--mantine-color-dark-3)" />
          <Text c="dark.2" ta="center">
            No templates yet. Open a project and choose <b>Save as template</b> to make one.
          </Text>
        </Stack>
      ) : (
        <Stack gap="xs">
          {templates.map((t) => (
            <Paper key={t.id} withBorder p="sm" radius="md">
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {t.name}
                  </Text>
                  <Group gap={6} mt={4}>
                    <Badge size="xs" variant="light" color="gray">
                      {t.module_count} {t.module_count === 1 ? 'section' : 'sections'}
                    </Badge>
                    <Badge size="xs" variant="light" color="gray">
                      {t.task_count} {t.task_count === 1 ? 'task' : 'tasks'}
                    </Badge>
                  </Group>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <Button size="xs" loading={busyId === t.id} onClick={() => startFromTemplate(t)}>
                    Use
                  </Button>
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
    </Modal>
  );
}
