import { useEffect, useState } from 'react';
import {
  Button,
  Center,
  Container,
  Group,
  Loader,
  MantineProvider,
  Text,
  Title,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { LogOut } from 'lucide-react';
import { getMe, logout } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  return (
    <MantineProvider defaultColorScheme="auto">
      <Notifications />
      <Container size="lg" py="md">
        <Group justify="space-between" mb="lg">
          <Title order={2}>Waypoint</Title>
          {user && (
            <Group gap="sm">
              <Text size="sm" c="dimmed">
                {user.email}
              </Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<LogOut size={14} />}
                onClick={handleLogout}
              >
                Log out
              </Button>
            </Group>
          )}
        </Group>

        {loading ? (
          <Center h={200}>
            <Loader />
          </Center>
        ) : user ? (
          <Dashboard />
        ) : (
          <AuthForm onAuthed={setUser} />
        )}
      </Container>
    </MantineProvider>
  );
}
