import { useState } from 'react';
import {
  Alert,
  Anchor,
  Box,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { login, register } from '../api.js';
import Logo from './Logo.jsx';

export default function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = isRegister ? await register(email, password) : await login(email, password);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Center mih="100vh" bg="dark.7" p="md">
      <Stack w="100%" maw={400} gap="xl">
        <Stack gap={6} align="center">
          <Logo size={40} />
          <Text size="sm" c="dark.2" ta="center">
            Plan with{' '}
            <Text span c="teal.4" inherit>
              clarity
            </Text>
            . Deliver with{' '}
            <Text span c="amber.5" inherit>
              confidence
            </Text>
            .
          </Text>
        </Stack>

        <Paper p="xl" radius="lg" withBorder bg="dark.6">
          <form onSubmit={handleSubmit}>
            <Stack>
              <Box>
                <Title order={2}>{isRegister ? 'Create an account' : 'Sign in'}</Title>
                <Text size="sm" c="dark.2" mt={4}>
                  {isRegister
                    ? 'Start organizing your projects.'
                    : 'Welcome back — pick up where you left off.'}
                </Text>
              </Box>
              <TextInput
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
              />
              <PasswordInput
                label="Password"
                placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                minLength={8}
                required
              />
              {error && (
                <Alert color="red" variant="light">
                  {error}
                </Alert>
              )}
              <Button type="submit" fullWidth size="md" loading={loading}>
                {isRegister ? 'Create account' : 'Log in'}
              </Button>
              <Text size="sm" c="dark.2" ta="center">
                {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
                <Anchor
                  component="button"
                  type="button"
                  c="teal.4"
                  onClick={() => {
                    setMode(isRegister ? 'login' : 'register');
                    setError(null);
                  }}
                >
                  {isRegister ? 'Sign in' : 'Register'}
                </Anchor>
              </Text>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Center>
  );
}
