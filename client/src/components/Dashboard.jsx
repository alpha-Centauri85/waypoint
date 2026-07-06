import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Center,
  Grid,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import { createProject, deleteProject, listProjects } from '../api.js';
import TaskList from './TaskList.jsx';
import ProjectEditModal from './ProjectEditModal.jsx';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState('');
  const [editingProject, setEditingProject] = useState(null);

  async function refresh() {
    const rows = await listProjects();
    setProjects(rows);
    // Keep a valid selection without depending on the current one in a closure.
    setSelectedId((cur) => (rows.some((p) => p.id === cur) ? cur : (rows[0]?.id ?? null)));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const project = await createProject(name);
    setNewName('');
    setSelectedId(project.id);
    refresh();
    notifications.show({ message: `Created “${project.name}”`, color: 'teal' });
  }

  async function handleDelete(id) {
    await deleteProject(id);
    refresh();
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <>
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
              {projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  active={p.id === selectedId}
                  onSelect={() => setSelectedId(p.id)}
                  onEdit={() => setEditingProject(p)}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
              {!projects.length && (
                <Text c="dark.2" size="sm" py="xs">
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
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 8, md: 9 }}>
          {selected ? <TaskList project={selected} /> : <EmptyState />}
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
  return (
    <Group
      gap={4}
      wrap="nowrap"
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        borderRadius: 8,
        padding: '6px 8px 6px 10px',
        backgroundColor: active ? 'var(--mantine-color-dark-5)' : 'transparent',
        borderLeft: active ? '3px solid var(--mantine-color-teal-5)' : '3px solid transparent',
      }}
    >
      <Text
        size="sm"
        fw={active ? 600 : 400}
        c={active ? 'white' : 'dark.1'}
        truncate
        style={{ flex: 1 }}
      >
        {project.name}
      </Text>
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
    </Group>
  );
}

function EmptyState() {
  return (
    <Center h={320}>
      <Stack align="center" gap="xs">
        <FolderKanban size={40} color="var(--mantine-color-dark-3)" />
        <Text c="dark.2">Create or select a project to get started.</Text>
      </Stack>
    </Center>
  );
}
