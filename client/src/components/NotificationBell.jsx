import { useCallback, useEffect, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Indicator,
  Popover,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { Bell, CalendarClock } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../api.js';
import { notifyError } from '../notify.js';

dayjs.extend(relativeTime);

// SQLite stores created_at as a UTC 'YYYY-MM-DD HH:MM:SS' string; treat it as UTC.
const asDate = (s) => dayjs(`${String(s).replace(' ', 'T')}Z`);

const POLL_MS = 60000;

// Header bell showing due-date reminders. Polls the API on a light interval so
// the unread badge stays current; clicking a reminder marks it read and opens
// the owning project.
export default function NotificationBell({ onOpenProject }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [opened, setOpened] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listNotifications(30);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnread(data?.unreadCount ?? 0);
    } catch {
      // A background poll failing shouldn't nag the user with a toast.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  async function openItem(n) {
    setOpened(false);
    if (!n.read_at) {
      try {
        await markNotificationRead(n.id);
        setUnread((u) => Math.max(0, u - 1));
        setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: 'now' } : x)));
      } catch (err) {
        notifyError(err);
      }
    }
    if (n.project_id != null) onOpenProject?.(n.project_id);
  }

  async function markAll() {
    try {
      await markAllNotificationsRead();
      setUnread(0);
      setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at ?? 'now' })));
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={340}
      position="bottom-end"
      shadow="md"
      withArrow
    >
      <Popover.Target>
        <Indicator
          color="amber"
          label={unread > 9 ? '9+' : unread}
          size={16}
          disabled={unread === 0}
          offset={4}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label="Notifications"
            onClick={() => setOpened((o) => !o)}
          >
            <Bell size={19} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <Group
          justify="space-between"
          px="sm"
          py="xs"
          style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
        >
          <Text fw={600} size="sm">
            Reminders
          </Text>
          {unread > 0 && (
            <Button variant="subtle" size="compact-xs" color="gray" onClick={markAll}>
              Mark all read
            </Button>
          )}
        </Group>
        {items.length === 0 ? (
          <Box px="sm" py="lg">
            <Text size="sm" c="dark.2" ta="center">
              Nothing due. You&rsquo;re all caught up.
            </Text>
          </Box>
        ) : (
          <ScrollArea.Autosize mah={360}>
            <Stack gap={0} py={4}>
              {items.map((n) => (
                <UnstyledButton
                  key={n.id}
                  onClick={() => openItem(n)}
                  px="sm"
                  py="xs"
                  style={{
                    display: 'block',
                    backgroundColor: n.read_at ? 'transparent' : 'var(--mantine-color-dark-6)',
                  }}
                >
                  <Group gap="xs" wrap="nowrap" align="flex-start">
                    <CalendarClock
                      size={16}
                      color={
                        n.due_date && n.due_date < dayjs().format('YYYY-MM-DD')
                          ? 'var(--mantine-color-red-5)'
                          : 'var(--mantine-color-amber-5)'
                      }
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" lineClamp={2}>
                        {n.message}
                      </Text>
                      <Text size="xs" c="dark.2">
                        {n.project_name ? `${n.project_name} · ` : ''}
                        {asDate(n.created_at).fromNow()}
                      </Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
