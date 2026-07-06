import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Brand fonts (self-hosted, no external dependency).
import '@fontsource-variable/inter';
import './assets/fonts/satoshi.css';
// Mantine styles must be imported once, before app styles.
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
