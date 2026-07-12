import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { CalendarClock, CheckSquare, Flag } from 'lucide-react';
import dayjs from 'dayjs';
import { PRIORITY_META } from '../priority.js';
import { getPublicProject } from '../api.js';
import Logo from './Logo.jsx';

// Public, no-login, read-only project view for /share/:token. It renders its own
// minimal header (just the logo — no user menu, no navigation) and a flat,
// read-only projection of the project fetched from GET /api/public/:token. It
// never mounts TaskList/TaskBoard/TaskEditModal and never shows comments,
// activity, members or subtask titles — only a subtask progress count.
export default function PublicProject({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getPublicProject(token)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <Box mih="100vh" bg="dark.7">
      <Box
        component="header"
        h={64}
        px="lg"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--mantine-color-dark-4)',
          backgroundColor: 'rgba(14, 22, 33, 0.85)',
        }}
      >
        <Logo size={26} />
      </Box>

      <Container size="lg" py="xl">
        {loading ? (
          <Center py="xl">
            <Loader color="teal" />
          </Center>
        ) : error || !data ? (
          <Center py="xl">
            <Card withBorder radius="lg" p="xl" w={420} maw="90vw">
              <Stack align="center" gap="sm">
                <Text fw={700} fz="lg" ta="center">
                  This link is unavailable
                </Text>
                <Text c="dimmed" size="sm" ta="center">
                  The share link may have been turned off, or it never existed.
                </Text>
              </Stack>
            </Card>
          </Center>
        ) : (
          <ProjectView data={data} />
        )}
      </Container>
    </Box>
  );
}

function ProjectView({ data }) {
  const { project, sections, statuses, tasks } = data;
  const statusById = Object.fromEntries(statuses.map((s) => [s.id, s]));

  // Group tasks by section, preserving section order; ungrouped tasks last.
  const bySection = new Map(sections.map((s) => [s.id, []]));
  const ungrouped = [];
  for (const t of tasks) {
    if (t.sectionId != null && bySection.has(t.sectionId)) bySection.get(t.sectionId).push(t);
    else ungrouped.push(t);
  }

  const groups = [
    ...sections.map((s) => ({ id: s.id, name: s.name, tasks: bySection.get(s.id) })),
    ...(ungrouped.length ? [{ id: 'ungrouped', name: 'Other tasks', tasks: ungrouped }] : []),
  ].filter((g) => g.tasks.length > 0);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Title order={2}>{project.name}</Title>
        <Badge variant="light" color="gray">
          Read-only
        </Badge>
      </Group>

      {groups.length === 0 ? (
        <Text c="dimmed">No tasks to show.</Text>
      ) : (
        groups.map((group) => (
          <Stack key={group.id} gap="xs">
            <Text fw={600} c="dark.1" tt="uppercase" fz="xs" style={{ letterSpacing: '0.06em' }}>
              {group.name}
            </Text>
            <Stack gap="xs">
              {group.tasks.map((task) => (
                <PublicTask key={task.id} task={task} status={statusById[task.statusId]} />
              ))}
            </Stack>
          </Stack>
        ))
      )}
    </Stack>
  );
}

function PublicTask({ task, status }) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          {status && (
            <Badge
              color={status.color}
              variant={status.is_done ? 'filled' : 'light'}
              w={110}
              style={{ flexShrink: 0 }}
            >
              {status.name}
            </Badge>
          )}
          <Text truncate>{task.title}</Text>
          {task.priority > 0 && (
            <Tooltip label={`${PRIORITY_META[task.priority].label} priority`}>
              <Flag
                size={14}
                style={{
                  flexShrink: 0,
                  color: `var(--mantine-color-${PRIORITY_META[task.priority].color}-5)`,
                  fill: `var(--mantine-color-${PRIORITY_META[task.priority].color}-5)`,
                }}
              />
            </Tooltip>
          )}
          {task.dueDate && (
            <Badge
              variant="light"
              color="gray"
              leftSection={<CalendarClock size={12} />}
              style={{ flexShrink: 0 }}
            >
              {dayjs(task.dueDate).format('MMM D')}
            </Badge>
          )}
          {(task.labels ?? []).map((label) => (
            <Badge key={label.id} variant="dot" color={label.color} style={{ flexShrink: 0 }}>
              {label.name}
            </Badge>
          ))}
        </Group>
        {task.subtaskTotal > 0 && (
          <Group gap={4} wrap="nowrap" c="dark.1" style={{ flexShrink: 0 }}>
            <CheckSquare size={14} />
            <Text size="sm">
              {task.subtaskDone} of {task.subtaskTotal} done
            </Text>
          </Group>
        )}
      </Group>
    </Paper>
  );
}
