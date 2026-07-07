import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Center, Group, Loader, Stack, Text } from '@mantine/core';
import { Check, Users } from 'lucide-react';
import { acceptInvite, previewInvite } from '../api.js';
import Logo from './Logo.jsx';

const MESSAGES = {
  not_found: 'This invite link is invalid.',
  used: 'This invite link has already been used.',
  expired: 'This invite link has expired.',
};

// Landing screen for /invite/:token. Shows what you're joining, then accepts and
// hands the project id back so the app can open it.
export default function InviteAccept({ token, onDone }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    previewInvite(token)
      .then(setPreview)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await acceptInvite(token);
      if (res.status === 'ok' || res.status === 'owner') {
        onDone(res.projectId);
      } else {
        setError(MESSAGES[res.status] ?? 'Could not accept this invite.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  }

  const invalid = preview && preview.status !== 'ok';

  return (
    <Center h="100vh" bg="dark.7">
      <Card withBorder radius="lg" p="xl" w={420} maw="90vw">
        <Stack align="center" gap="md">
          <Logo size={28} />
          {loading ? (
            <Loader color="teal" />
          ) : invalid ? (
            <>
              <Alert color="red" variant="light" w="100%">
                {MESSAGES[preview.status] ?? 'This invite link is invalid.'}
              </Alert>
              <Button variant="default" onClick={() => onDone(null)}>
                Go to Waypoint
              </Button>
            </>
          ) : (
            <>
              <Users size={32} color="var(--mantine-color-teal-4)" />
              <Text ta="center">
                You’ve been invited by <b>{preview.inviterEmail}</b> to join
              </Text>
              <Text fw={700} fz="lg" ta="center">
                {preview.projectName}
              </Text>
              <Badge variant="light" color={preview.role === 'editor' ? 'teal' : 'gray'}>
                {preview.role === 'editor' ? 'Editor — can edit tasks' : 'Viewer — read-only'}
              </Badge>
              {error && (
                <Alert color="red" variant="light" w="100%">
                  {error}
                </Alert>
              )}
              <Group>
                <Button variant="default" onClick={() => onDone(null)}>
                  Not now
                </Button>
                <Button leftSection={<Check size={16} />} loading={accepting} onClick={accept}>
                  Join project
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Card>
    </Center>
  );
}
