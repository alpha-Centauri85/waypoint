import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Boxes, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { bulkCreateModules, deleteModule, listModules } from '../api.js';
import { notifyError } from '../notify.js';
import ModuleEditorModal from './ModuleEditorModal.jsx';

// The module library: reusable, label-tagged task bundles. Bulk-create shells to
// flesh out later, or build one in full; each is edited in ModuleEditorModal.
export default function ModulesModal({ opened, onClose }) {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState(null); // null = new module
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setModules(await listModules());
    } catch (err) {
      notifyError(err, 'Could not load modules');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (opened) refresh();
  }, [opened]);

  function openEditor(id) {
    setEditorId(id);
    setEditorOpen(true);
  }

  async function remove(m) {
    try {
      await deleteModule(m.id);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete module');
    }
  }

  async function createBulk() {
    const names = bulkText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.length) return;
    setBulkSaving(true);
    try {
      await bulkCreateModules(names);
      notifications.show({ message: `Created ${names.length} modules`, color: 'teal' });
      setBulkText('');
      setBulkOpen(false);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not create modules');
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Module library" size="lg" centered>
      <Group justify="space-between" mb="sm">
        <Text size="sm" c="dark.2">
          Reusable task bundles, injected into templates by matching labels.
        </Text>
        <Group gap="xs">
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<Layers size={14} />}
            onClick={() => setBulkOpen((o) => !o)}
          >
            Bulk add
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<Plus size={14} />}
            onClick={() => openEditor(null)}
          >
            New module
          </Button>
        </Group>
      </Group>

      <Collapse in={bulkOpen}>
        <Paper withBorder p="sm" radius="md" mb="sm" bg="dark.7">
          <Textarea
            label="Create shells"
            placeholder="One module name per line"
            value={bulkText}
            onChange={(e) => setBulkText(e.currentTarget.value)}
            autosize
            minRows={3}
          />
          <Group justify="flex-end" mt="xs">
            <Button size="xs" loading={bulkSaving} onClick={createBulk}>
              Create modules
            </Button>
          </Group>
        </Paper>
      </Collapse>

      {loading ? (
        <Group justify="center" py="lg">
          <Loader color="teal" />
        </Group>
      ) : modules.length === 0 ? (
        <Stack align="center" gap="xs" py="lg">
          <Boxes size={36} color="var(--mantine-color-dark-3)" />
          <Text c="dark.2" ta="center">
            No modules yet. Create one, then tag it with labels so templates can pull it in.
          </Text>
        </Stack>
      ) : (
        <Stack gap="xs">
          {modules.map((m) => (
            <Paper key={m.id} withBorder p="sm" radius="md">
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {m.name}
                  </Text>
                  <Group gap={6} mt={4}>
                    <Badge size="xs" variant="light" color="gray">
                      {m.task_count} {m.task_count === 1 ? 'task' : 'tasks'}
                    </Badge>
                    {(m.labels ?? []).map((l) => (
                      <Badge key={l.id} size="xs" variant="dot" color={l.color ?? 'gray'}>
                        {l.name}
                      </Badge>
                    ))}
                  </Group>
                </div>
                <Group gap="xs" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label="Edit module"
                    onClick={() => openEditor(m.id)}
                  >
                    <Pencil size={15} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label="Delete module"
                    onClick={() => remove(m)}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          ))}
        </Stack>
      )}

      <Divider my="md" />
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Done
        </Button>
      </Group>

      <ModuleEditorModal
        opened={editorOpen}
        moduleId={editorId}
        onClose={() => setEditorOpen(false)}
        onSaved={refresh}
      />
    </Modal>
  );
}
