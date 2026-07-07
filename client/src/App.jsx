import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Center,
  Container,
  Loader,
  MantineProvider,
  Menu,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Boxes, ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { theme } from './theme.js';
import { getMe, logout } from './api.js';
import { StatusesProvider } from './statuses.jsx';
import Logo from './components/Logo.jsx';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import SettingsScreen from './components/SettingsScreen.jsx';
import ModulesModal from './components/ModulesModal.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'settings'
  const [modulesOpen, setModulesOpen] = useState(false);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    setView('dashboard');
  }

  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <Notifications position="top-right" />
      {loading ? (
        <Center h="100vh">
          <Loader color="teal" />
        </Center>
      ) : user ? (
        <StatusesProvider>
          <AppFrame
            user={user}
            onLogout={handleLogout}
            onHome={() => setView('dashboard')}
            onSettings={() => setView('settings')}
            onModules={() => setModulesOpen(true)}
          >
            {view === 'settings' ? <SettingsScreen /> : <Dashboard />}
          </AppFrame>
          <ModulesModal opened={modulesOpen} onClose={() => setModulesOpen(false)} />
        </StatusesProvider>
      ) : (
        <AuthForm onAuthed={setUser} />
      )}
    </MantineProvider>
  );
}

// The signed-in shell: a sticky brand header over the working area.
function AppFrame({ user, onLogout, onHome, onSettings, onModules, children }) {
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
        <UnstyledButton onClick={onHome} aria-label="Waypoint home">
          <Logo size={26} />
        </UnstyledButton>
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
            <Menu.Item leftSection={<Boxes size={15} />} onClick={onModules}>
              Module library
            </Menu.Item>
            <Menu.Item leftSection={<SettingsIcon size={15} />} onClick={onSettings}>
              Settings
            </Menu.Item>
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
