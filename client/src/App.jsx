import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Center,
  Container,
  Group,
  Loader,
  MantineProvider,
  Menu,
  Text,
  UnstyledButton,
  useMantineColorScheme,
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import {
  Boxes,
  ChevronDown,
  LayoutTemplate,
  LogOut,
  Moon,
  Settings as SettingsIcon,
  Sun,
} from 'lucide-react';
import { theme } from './theme.js';
import { getMe, logout, updateMe } from './api.js';
import { StatusesProvider } from './statuses.jsx';
import Logo from './components/Logo.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import SettingsScreen from './components/SettingsScreen.jsx';
import TemplatesPage from './components/TemplatesPage.jsx';
import ModulesPage from './components/ModulesPage.jsx';
import InviteAccept from './components/InviteAccept.jsx';

// An /invite/:token deep link (SPA fallback serves index.html for it).
const inviteToken = () => window.location.pathname.match(/^\/invite\/([^/]+)$/)?.[1] ?? null;

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <AppInner />
    </MantineProvider>
  );
}

function AppInner() {
  const { setColorScheme } = useMantineColorScheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); // dashboard | settings | templates | modules
  const [focusProjectId, setFocusProjectId] = useState(null); // project to select after nav
  const [invite, setInvite] = useState(inviteToken); // token from /invite/:token, or null

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        // Apply the saved scheme so the choice follows the user across devices.
        setColorScheme(u.theme === 'light' ? 'light' : 'dark');
      })
      .catch(() => {
        setUser(null);
        setColorScheme('dark'); // pre-login screens stay dark-branded
      })
      .finally(() => setLoading(false));
    // Run once on mount. `setColorScheme` from Mantine is not a stable reference,
    // so listing it as a dependency would re-run this and loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    setColorScheme('dark');
    setView('dashboard');
  }

  // Jump to a project (e.g. after instantiating a template) and select it.
  function openProject(project) {
    setFocusProjectId(project.id);
    setView('dashboard');
  }

  // Finished with an invite: clear the /invite/ URL and open the project (if joined).
  function finishInvite(projectId) {
    window.history.replaceState({}, '', '/');
    setInvite(null);
    setView('dashboard');
    if (projectId != null) setFocusProjectId(projectId);
  }

  // After sign-in, adopt the account's saved scheme (login/register return it).
  function handleAuthed(u) {
    setUser(u);
    setColorScheme(u.theme === 'light' ? 'light' : 'dark');
  }

  return (
    <>
      {loading ? (
        <Center h="100vh">
          <Loader color="teal" />
        </Center>
      ) : !user ? (
        <AuthForm onAuthed={handleAuthed} />
      ) : invite ? (
        <InviteAccept token={invite} onDone={finishInvite} />
      ) : (
        <StatusesProvider>
          <AppFrame
            user={user}
            onLogout={handleLogout}
            onHome={() => setView('dashboard')}
            onSettings={() => setView('settings')}
            onModules={() => setView('modules')}
            onTemplates={() => setView('templates')}
            onOpenProject={(id) => {
              setFocusProjectId(id);
              setView('dashboard');
            }}
          >
            {view === 'settings' ? (
              <SettingsScreen />
            ) : view === 'templates' ? (
              <TemplatesPage onInstantiated={openProject} />
            ) : view === 'modules' ? (
              <ModulesPage />
            ) : (
              <Dashboard
                onOpenTemplates={() => setView('templates')}
                focusProjectId={focusProjectId}
                onFocused={() => setFocusProjectId(null)}
              />
            )}
          </AppFrame>
        </StatusesProvider>
      )}
    </>
  );
}

// The signed-in shell: a sticky brand header over the working area.
function AppFrame({
  user,
  onLogout,
  onHome,
  onSettings,
  onModules,
  onTemplates,
  onOpenProject,
  children,
}) {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  // Flip the scheme locally, then persist it server-side (best-effort).
  function toggleTheme() {
    const next = dark ? 'light' : 'dark';
    setColorScheme(next);
    updateMe({ theme: next }).catch(() => {});
  }

  return (
    <Box mih="100vh" bg="var(--mantine-color-body)">
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
          backgroundColor: 'light-dark(rgba(241, 243, 245, 0.85), rgba(14, 22, 33, 0.85))',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <UnstyledButton onClick={onHome} aria-label="Waypoint home">
          <Logo size={26} />
        </UnstyledButton>
        <Group gap="xs">
          <NotificationBell onOpenProject={onOpenProject} />
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                rightSection={<ChevronDown size={15} />}
              >
                <Text size="sm">{user.email}</Text>
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={dark ? <Sun size={15} /> : <Moon size={15} />}
                onClick={toggleTheme}
              >
                {dark ? 'Light mode' : 'Dark mode'}
              </Menu.Item>
              <Menu.Item leftSection={<LayoutTemplate size={15} />} onClick={onTemplates}>
                Templates
              </Menu.Item>
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
        </Group>
      </Box>

      <Container size="xl" py="xl">
        {children}
      </Container>
    </Box>
  );
}
