import { useEffect, useState } from 'react';
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

  if (loading) return <p className="app">Loading…</p>;

  return (
    <div className="app">
      <header className="app-header">
        <h1>Waypoint</h1>
        {user && (
          <div className="app-user">
            <span>{user.email}</span>
            <button onClick={handleLogout}>Log out</button>
          </div>
        )}
      </header>
      {user ? <Dashboard /> : <AuthForm onAuthed={setUser} />}
    </div>
  );
}
