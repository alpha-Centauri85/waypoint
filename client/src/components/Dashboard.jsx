import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Grid,
  Group,
  NavLink,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2 } from 'lucide-react';
import { createProject, deleteProject, listProjects } from '../api.js';
import TaskList from './TaskList.jsx';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState('');

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
    notifications.show({ message: `Created “${project.name}”`, color: 'green' });
  }

  async function handleDelete(id) {
    await deleteProject(id);
    refresh();
  }

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 4, md: 3 }}>
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="sm">
            Projects
          </Title>
          <Stack gap={2}>
            {projects.map((p) => (
              <Group key={p.id} justify="space-between" gap="xs" wrap="nowrap">
                <NavLink
                  label={p.name}
                  active={p.id === selectedId}
                  onClick={() => setSelectedId(p.id)}
                  style={{ borderRadius: 6 }}
                />
                <ActionIcon
                  variant="subtle"
                  color="red"
                  aria-label="Delete project"
                  onClick={() => handleDelete(p.id)}
                >
                  <Trash2 size={16} />
                </ActionIcon>
              </Group>
            ))}
            {!projects.length && (
              <Text c="dimmed" size="sm">
                No projects yet
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
                <Plus size={16} />
              </ActionIcon>
            </Group>
          </form>
        </Paper>
      </Grid.Col>

      <Grid.Col span={{ base: 12, sm: 8, md: 9 }}>
        {selected ? (
          <TaskList project={selected} />
        ) : (
          <Text c="dimmed">Create or select a project to get started.</Text>
        )}
      </Grid.Col>
    </Grid>
  );
}
