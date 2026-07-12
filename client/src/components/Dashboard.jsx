import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FolderKanban, LayoutTemplate, Pencil, Plus, Trash2 } from 'lucide-react';
import { createProject, deleteProject, listProjects } from '../api.js';
import { notifyError } from '../notify.js';
import TaskList from './TaskList.jsx';
import ProjectEditModal from './ProjectEditModal.jsx';
import SearchBar from './SearchBar.jsx';
import { ProjectStatusesProvider } from '../statuses.jsx';

// Templates and the module library live on their own pages (header menu);
// `onOpenTemplates` navigates there. `focusProjectId` selects a project after
// returning from another page (e.g. a template just created it).
export default function Dashboard({ onOpenTemplates, focusProjectId, onFocused }) {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const rows = await listProjects();
      setProjects(rows);
      // Keep a valid selection without depending on the current one in a closure.
      setSelectedId((cur) => (rows.some((p) => p.id === cur) ? cur : (rows[0]?.id ?? null)));
    } catch (err) {
      notifyError(err, 'Could not load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // A project created elsewhere (e.g. instantiated from a template): select it.
  useEffect(() => {
    if (focusProjectId == null) return;
    setSelectedId(focusProjectId);
    refresh();
    onFocused?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusProjectId]);

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const project = await createProject(name);
      setNewName('');
      setSelectedId(project.id);
      refresh();
      notifications.show({ message: `Created “${project.name}”`, color: 'teal' });
    } catch (err) {
      notifyError(err, 'Could not create project');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteProject(id);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not delete project');
    }
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <>
      <Box maw={520} mb="lg">
        <SearchBar onSelectProject={(id) => setSelectedId(id)} />
      </Box>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
          <Paper withBorder p="md" radius="lg">
            <Group justify="space-between" mb="md">
              <Title order={4}>Projects</Title>
              {projects.length > 0 && (
                <Badge variant="light" color="gray" size="sm">
                  {projects.length}
                </Badge>
              )}
            </Group>

            <Stack gap={4}>
              {loading ? (
                <Center py="lg">
                  <Loader size="sm" color="teal" />
                </Center>
              ) : (
                projects.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    active={p.id === selectedId}
                    onSelect={() => setSelectedId(p.id)}
                    onEdit={() => setEditingProject(p)}
                    onDelete={() => handleDelete(p.id)}
                  />
                ))
              )}
              {!loading && !projects.length && (
                <Text c="dimmed" size="sm" py="xs">
                  No projects yet. Add your first one below.
                </Text>
              )}
            </Stack>

            <form onSubmit={handleCreate}>
              <Group gap="xs" mt="md" wrap="nowrap">
                <TextInput
                  placeholder="New project"
                  value={newName}
                  onChange={(e) => setNewName(e.currentTarget.value)}
                  style={{ flex: 1 }}
                />
                <ActionIcon type="submit" variant="filled" size="lg" aria-label="Add project">
                  <Plus size={18} />
                </ActionIcon>
              </Group>
            </form>
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              mt="xs"
              fullWidth
              leftSection={<LayoutTemplate size={14} />}
              onClick={onOpenTemplates}
            >
              Start from a template
            </Button>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 8, md: 9 }}>
          {selected ? (
            <ProjectStatusesProvider key={selected.id} projectId={selected.id}>
              <TaskList project={selected} onTasksChanged={refresh} />
            </ProjectStatusesProvider>
          ) : (
            !loading && <EmptyState />
          )}
        </Grid.Col>
      </Grid>

      <ProjectEditModal
        project={editingProject}
        opened={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSaved={refresh}
      />
    </>
  );
}

function ProjectRow({ project, active, onSelect, onEdit, onDelete }) {
  const total = project.task_count ?? 0;
  const done = project.done_count ?? 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const complete = total > 0 && done === total;
  const role = project.role ?? 'owner';

  return (
    <Stack
      gap={6}
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        borderRadius: 8,
        padding: '8px 8px 10px 10px',
        backgroundColor: active
          ? 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-5))'
          : 'transparent',
        borderLeft: active ? '3px solid var(--mantine-color-teal-5)' : '3px solid transparent',
      }}
    >
      <Group gap={4} wrap="nowrap">
        <Text
          size="sm"
          fw={active ? 600 : 400}
          c={active ? undefined : 'dimmed'}
          truncate
          style={{ flex: 1 }}
        >
          {project.name}
        </Text>
        {role !== 'viewer' && (
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            aria-label="Edit project"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil size={14} />
          </ActionIcon>
        )}
        {role === 'owner' && (
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            aria-label="Delete project"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} />
          </ActionIcon>
        )}
      </Group>
      {role !== 'owner' && (
        <Group gap={6} wrap="nowrap">
          <Badge size="xs" variant="light" color={role === 'editor' ? 'teal' : 'gray'}>
            {role}
          </Badge>
          <Text size="xs" c="dimmed" truncate>
            shared by {project.owner_email}
          </Text>
        </Group>
      )}
      {(project.labels ?? []).length > 0 && (
        <Group gap={4}>
          {project.labels.map((label) => (
            <Badge key={label.id} size="xs" variant="dot" color={label.color}>
              {label.name}
            </Badge>
          ))}
        </Group>
      )}
      <Group gap={8} wrap="nowrap" pr={4}>
        <Progress
          value={total ? pct : 0}
          color={complete ? 'teal' : 'amber'}
          size="sm"
          radius="xl"
          style={{ flex: 1 }}
          aria-label={`${done} of ${total} tasks done`}
        />
        <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {total ? `${done}/${total}` : '—'}
        </Text>
      </Group>
    </Stack>
  );
}

function EmptyState() {
  return (
    <Center h={320}>
      <Stack align="center" gap="xs">
        <FolderKanban size={40} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed">Create or select a project to get started.</Text>
      </Stack>
    </Center>
  );
}
