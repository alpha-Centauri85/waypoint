import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Check, Copy, Link as LinkIcon, Trash2 } from 'lucide-react';
import { createInvite, listMembers, removeMember, revokeInvite, setMemberRole } from '../api.js';
import { notifyError } from '../notify.js';

const ROLES = [
  { value: 'editor', label: 'Editor — can edit tasks' },
  { value: 'viewer', label: 'Viewer — read-only' },
];

const inviteUrl = (token) => `${window.location.origin}/invite/${token}`;

// Manage who can access a project. Owners invite via shareable links and set/remove
// roles; collaborators see the roster and can leave.
export default function ShareModal({ opened, project, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState('editor');
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setData(await listMembers(project.id));
    } catch (err) {
      notifyError(err, 'Could not load members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (opened) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, project.id]);

  const isOwner = data?.role === 'owner';

  async function makeInvite() {
    setCreating(true);
    try {
      await createInvite(project.id, newRole);
      refresh();
    } catch (err) {
      notifyError(err, 'Could not create invite');
    } finally {
      setCreating(false);
    }
  }

  async function changeRole(userId, role) {
    try {
      await setMemberRole(project.id, userId, role);
      refresh();
      onChanged?.();
    } catch (err) {
      notifyError(err, 'Could not change role');
    }
  }

  async function remove(userId, isSelf) {
    try {
      await removeMember(project.id, userId);
      notifications.show({ message: isSelf ? 'Left project' : 'Member removed', color: 'teal' });
      if (isSelf) {
        onChanged?.();
        onClose();
      } else {
        refresh();
      }
    } catch (err) {
      notifyError(err, 'Could not remove member');
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={`Share “${project.name}”`} size="lg" centered>
      {loading || !data ? (
        <Group justify="center" py="lg">
          <Loader color="teal" />
        </Group>
      ) : (
        <Stack>
          {isOwner && (
            <>
              <Text size="sm" fw={600}>
                Invite by link
              </Text>
              <Group gap="xs" align="flex-end">
                <Select
                  label="Role"
                  data={ROLES}
                  value={newRole}
                  onChange={(v) => setNewRole(v ?? 'editor')}
                  allowDeselect={false}
                  style={{ flex: 1 }}
                />
                <Button
                  leftSection={<LinkIcon size={15} />}
                  loading={creating}
                  onClick={makeInvite}
                >
                  Create link
                </Button>
              </Group>

              {data.invites.length > 0 && (
                <Stack gap="xs">
                  {data.invites.map((inv) => (
                    <Paper
                      key={inv.id}
                      withBorder
                      p="xs"
                      radius="md"
                      bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))"
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                          <Badge size="xs" variant="light" color="gray">
                            {inv.role}
                          </Badge>
                          <TextInput
                            readOnly
                            size="xs"
                            value={inviteUrl(inv.token)}
                            style={{ flex: 1, minWidth: 0 }}
                            onFocus={(e) => e.currentTarget.select()}
                          />
                        </Group>
                        <Group gap={4} wrap="nowrap">
                          <CopyButton value={inviteUrl(inv.token)}>
                            {({ copied, copy }) => (
                              <ActionIcon
                                variant="subtle"
                                color={copied ? 'teal' : 'gray'}
                                aria-label="Copy invite link"
                                onClick={copy}
                              >
                                {copied ? <Check size={15} /> : <Copy size={15} />}
                              </ActionIcon>
                            )}
                          </CopyButton>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label="Revoke invite"
                            onClick={() =>
                              revokeInvite(project.id, inv.id)
                                .then(refresh)
                                .catch(() => {})
                            }
                          >
                            <Trash2 size={15} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
              <Divider />
            </>
          )}

          <Text size="sm" fw={600}>
            People
          </Text>
          <Stack gap="xs">
            {data.members.map((m) => {
              const isSelf = m.user_id === data.me;
              return (
                <Group key={m.user_id} justify="space-between" wrap="nowrap">
                  <Text size="sm" truncate>
                    {m.email}
                    {isSelf ? ' (you)' : ''}
                  </Text>
                  {m.role === 'owner' ? (
                    <Badge variant="light" color="teal">
                      owner
                    </Badge>
                  ) : isOwner ? (
                    <Group gap="xs" wrap="nowrap">
                      <Select
                        size="xs"
                        w={110}
                        data={[
                          { value: 'editor', label: 'editor' },
                          { value: 'viewer', label: 'viewer' },
                        ]}
                        value={m.role}
                        onChange={(v) => v && changeRole(m.user_id, v)}
                        allowDeselect={false}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Remove member"
                        onClick={() => remove(m.user_id, false)}
                      >
                        <Trash2 size={15} />
                      </ActionIcon>
                    </Group>
                  ) : isSelf ? (
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      onClick={() => remove(m.user_id, true)}
                    >
                      Leave
                    </Button>
                  ) : (
                    <Badge variant="light" color="gray">
                      {m.role}
                    </Badge>
                  )}
                </Group>
              );
            })}
          </Stack>
        </Stack>
      )}
    </Modal>
  );
}
