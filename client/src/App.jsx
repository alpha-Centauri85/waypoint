import { useEffect, useState } from 'react';
import { Box, Button, Center, Container, Loader, MantineProvider, Menu, Text } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ChevronDown, LogOut } from 'lucide-react';
import { theme } from './theme.js';
import { getMe, logout } from './api.js';
import Logo from './components/Logo.jsx';
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
    <MantineProvider theme={theme} forceColorScheme="dark">
      <Notifications position="top-right" />
      {loading ? (
        <Center h="100vh">
          <Loader color="teal" />
        </Center>
      ) : user ? (
        <AppFrame user={user} onLogout={handleLogout}>
          <Dashboard />
        </AppFrame>
      ) : (
        <AuthForm onAuthed={setUser} />
      )}
    </MantineProvider>
  );
}

// The signed-in shell: a sticky brand header over the working area.
function AppFrame({ user, onLogout, children }) {
  return (
    <Box mih="100vh" bg="dark.7">
      <Box
        component="header"
        h={64}
        px="lg"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(14, 22, 33, 0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--mantine-color-dark-4)',
        }}
      >
        <Logo size={26} />
        <Menu shadow="md" width={200} position="bottom-end">
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              rightSection={<ChevronDown size={15} />}
            >
              <Text size="sm" c="dark.1">
                {user.email}
              </Text>
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<LogOut size={15} />} onClick={onLogout}>
              Log out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>

      <Container size="xl" py="xl">
        {children}
      </Container>
    </Box>
  );
}
