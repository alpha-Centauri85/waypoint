import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Boxes, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { bulkCreateModules, deleteModule, listModules } from '../api.js';
import { notifyError } from '../notify.js';
import ModuleEditor from './ModuleEditor.jsx';

// Full page for the module library: reusable, label-tagged task bundles. Bulk-add
// shells, or build one in full; each opens a full-width inline editor.
export default function ModulesPage() {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | id
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
    refresh();
  }, []);

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

  if (editing !== null) {
    return (
      <ModuleEditor
        moduleId={editing === 'new' ? null : editing}
        onBack={() => setEditing(null)}
        onSaved={(saved) => {
          refresh();
          if (editing === 'new' && saved?.id) setEditing(saved.id);
        }}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" mb="xs">
        <Title order={2}>Module library</Title>
        <Group gap="xs">
          <Button
            variant="subtle"
            color="gray"
            leftSection={<Layers size={16} />}
            onClick={() => setBulkOpen((o) => !o)}
          >
            Bulk add
          </Button>
          <Button leftSection={<Plus size={16} />} onClick={() => setEditing('new')}>
            New module
          </Button>
        </Group>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Reusable task bundles, injected into a project’s section when you apply a matching label at
        creation time.
      </Text>

      <Collapse in={bulkOpen}>
        <Paper
          withBorder
          p="md"
          radius="md"
          mb="md"
          bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
        >
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
        <Group justify="center" py="xl">
          <Loader color="teal" />
        </Group>
      ) : modules.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <Boxes size={40} color="var(--mantine-color-dimmed)" />
          <Text c="dimmed" ta="center">
            No modules yet. Create one, then tag it with labels so templates can pull it in.
          </Text>
        </Stack>
      ) : (
        <Stack gap="xs">
          {modules.map((m) => (
            <Paper key={m.id} withBorder p="md" radius="md">
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
                    onClick={() => setEditing(m.id)}
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
    </>
  );
}
