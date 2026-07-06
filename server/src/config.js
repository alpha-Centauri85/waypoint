import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(here, '..', 'data');
const nodeEnv = process.env.NODE_ENV || 'development';

// Parse a boolean env var; falls back to `fallback` when unset/empty.
function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

// Interpret TRUST_PROXY: a number of hops, a boolean, or a named value
// (e.g. 'loopback') passed straight to Express's `trust proxy` setting.
function trustProxy(value) {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  const n = Number(value);
  return Number.isNaN(n) ? value : n;
}

// Single source of truth for environment config. Read env through this object,
// not process.env directly, so defaults and coercion live in one place.
export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',
  dataDir,
  // The SQLite database file. ':memory:' is used by tests.
  dbPath: process.env.DB_PATH || path.join(dataDir, 'waypoint.db'),
  // Rate limiting for the auth endpoints (brute-force / abuse surface).
  authRateLimit: {
    windowMs: Number(process.env.AUTH_RATE_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    max: Number(process.env.AUTH_RATE_MAX) || 20,
  },
  // Serve the built client (client/dist) from Express — single-origin production
  // deploy. On by default in production; opt-in elsewhere via SERVE_CLIENT=true.
  serveClient: bool(process.env.SERVE_CLIENT, nodeEnv === 'production'),
  clientDist: process.env.CLIENT_DIST || path.join(here, '..', '..', 'client', 'dist'),
  // Session cookies require HTTPS when `secure`. Defaults to on in production;
  // set SECURE_COOKIES=false to run production over plain HTTP (e.g. behind a
  // proxy that terminates TLS, or for a quick LAN trial).
  secureCookies: bool(process.env.SECURE_COOKIES, nodeEnv === 'production'),
  // Needed so `secure` cookies + rate-limit client IPs work behind a reverse
  // proxy (Caddy/IIS/nginx). e.g. TRUST_PROXY=1.
  trustProxy: trustProxy(process.env.TRUST_PROXY),
  // Where `npm run db:backup` writes WAL-safe snapshots, and how many to keep.
  backupDir: process.env.BACKUP_DIR || path.join(dataDir, 'backups'),
  backupKeep: Number(process.env.BACKUP_KEEP) || 14,
};
