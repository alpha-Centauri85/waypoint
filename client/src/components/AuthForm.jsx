import { useState } from 'react';
import {
  Alert,
  Anchor,
  Button,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { login, register } from '../api.js';

export default function AuthForm({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const isRegister = mode === 'register';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const user = isRegister ? await register(email, password) : await login(email, password);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Paper maw={380} mx="auto" mt="xl" p="lg" radius="md" withBorder>
      <form onSubmit={handleSubmit}>
        <Stack>
          <Title order={2}>{isRegister ? 'Create an account' : 'Sign in'}</Title>
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Password"
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
          <Button type="submit" fullWidth>
            {isRegister ? 'Register' : 'Log in'}
          </Button>
          <Text size="sm">
            {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
            <Anchor
              component="button"
              type="button"
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
  );
}
