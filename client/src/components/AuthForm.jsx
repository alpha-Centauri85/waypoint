import { useState } from 'react';
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
      const user = isRegister
        ? await register(email, password)
        : await login(email, password);
      onAuthed(user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="auth" onSubmit={handleSubmit}>
      <h2>{isRegister ? 'Create an account' : 'Sign in'}</h2>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button type="submit">{isRegister ? 'Register' : 'Log in'}</button>
      <p>
        {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
        <button
          type="button"
          className="link"
          onClick={() => {
            setMode(isRegister ? 'login' : 'register');
            setError(null);
          }}
        >
          {isRegister ? 'Sign in' : 'Register'}
        </button>
      </p>
    </form>
  );
}
