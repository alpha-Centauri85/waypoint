import { useEffect, useState } from 'react';
import { Drawer, Group, Loader, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { FolderPlus, History, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { listActivities } from '../api.js';
import { notifyError } from '../notify.js';

dayjs.extend(relativeTime);

// SQLite stores created_at as UTC "YYYY-MM-DD HH:MM:SS"; make it a real instant.
const asDate = (s) => dayjs(`${String(s).replace(' ', 'T')}Z`);

// Icon + accent per activity action (prefix-matched, so new actions degrade
// gracefully to a sensible default).
function iconFor(action) {
  if (action === 'task.deleted') return { Icon: Trash2, color: 'red' };
  if (action === 'task.status_changed') return { Icon: RefreshCw, color: 'amber' };
  if (action === 'task.created') return { Icon: Plus, color: 'teal' };
  if (action === 'project.created') return { Icon: FolderPlus, color: 'teal' };
  return { Icon: Pencil, color: 'gray' }; // *.updated / *.renamed
}

// A per-project activity timeline, opened from the project actions menu.
export default function ActivityDrawer({ opened, projectId, projectName, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!opened || projectId == null) return;
    setLoading(true);
    listActivities({ projectId })
      .then(setItems)
      .catch((err) => notifyError(err, 'Could not load activity'))
      .finally(() => setLoading(false));
  }, [opened, projectId]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Group gap="xs">
          <History size={18} />
          <Text fw={600}>Activity{projectName ? ` — ${projectName}` : ''}</Text>
        </Group>
      }
    >
      {loading ? (
        <Group justify="center" py="xl">
          <Loader color="teal" />
        </Group>
      ) : items.length === 0 ? (
        <Text c="dark.2" ta="center" py="xl">
          No activity yet.
        </Text>
      ) : (
        <Stack gap="md">
          {items.map((a) => {
            const { Icon, color } = iconFor(a.action);
            return (
              <Group key={a.id} gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon variant="light" color={color} size="md" radius="xl">
                  <Icon size={15} />
                </ThemeIcon>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm">{a.summary}</Text>
                  <Tooltip
                    label={asDate(a.created_at).format('MMM D, YYYY h:mm A')}
                    openDelay={300}
                  >
                    <Text size="xs" c="dark.2">
                      {asDate(a.created_at).fromNow()}
                    </Text>
                  </Tooltip>
                </div>
              </Group>
            );
          })}
        </Stack>
      )}
    </Drawer>
  );
}
