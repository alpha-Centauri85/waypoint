import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(here, '..', 'data');

// Single source of truth for environment config. Read env through this object,
// not process.env directly, so defaults and coercion live in one place.
export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',
  dataDir,
  // The SQLite database file. ':memory:' is used by tests.
  dbPath: process.env.DB_PATH || path.join(dataDir, 'waypoint.db'),
};
