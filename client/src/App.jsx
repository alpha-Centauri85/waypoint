import { useEffect, useState } from 'react';
import { getHealth } from './api.js';

export default function App() {
  const [status, setStatus] = useState('checking…');

  useEffect(() => {
    getHealth()
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return (
    <main className="app">
      <h1>Waypoint</h1>
      <p>
        API status: <strong>{status}</strong>
      </p>
    </main>
  );
}
