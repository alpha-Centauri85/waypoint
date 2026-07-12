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
} from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Boxes, ChevronDown, LayoutTemplate, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { theme } from './theme.js';
import { getMe, logout } from './api.js';
import { StatusesProvider } from './statuses.jsx';
import Logo from './components/Logo.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import AuthForm from './components/AuthForm.jsx';
import Dashboard from './components/Dashboard.jsx';
import SettingsScreen from './components/SettingsScreen.jsx';
import TemplatesPage from './components/TemplatesPage.jsx';
import ModulesPage from './components/ModulesPage.jsx';
import InviteAccept from './components/InviteAccept.jsx';
import PublicProject from './components/PublicProject.jsx';

// An /invite/:token deep link (SPA fallback serves index.html for it).
const inviteToken = () => window.location.pathname.match(/^\/invite\/([^/]+)$/)?.[1] ?? null;
// A /share/:token public no-login view (SPA fallback serves index.html for it).
const shareToken = () => window.location.pathname.match(/^\/share\/([^/]+)$/)?.[1] ?? null;

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard'); // dashboard | settings | templates | modules
  const [focusProjectId, setFocusProjectId] = useState(null); // project to select after nav
  const [invite, setInvite] = useState(inviteToken); // token from /invite/:token, or null
  const [share] = useState(shareToken); // token from /share/:token (public no-login view), or null

  useEffect(() => {
    // The public share view is fully unauthenticated — don't probe the session.
    if (share) return;
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [share]);

  async function handleLogout() {
    await logout();
    setUser(null);
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

  // Public no-login share view: short-circuit BEFORE the auth gate so we never
  // call getMe or render any signed-in shell / edit control.
  if (share) {
    return (
      <MantineProvider theme={theme} forceColorScheme="dark">
        <PublicProject token={share} />
      </MantineProvider>
    );
  }

  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <Notifications position="top-right" />
      {loading ? (
        <Center h="100vh">
          <Loader color="teal" />
        </Center>
      ) : !user ? (
        <AuthForm onAuthed={setUser} />
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
    </MantineProvider>
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
                <Text size="sm" c="dark.1">
                  {user.email}
                </Text>
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
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
