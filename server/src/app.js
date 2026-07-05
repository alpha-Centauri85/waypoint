import express from 'express';
import cors from 'cors';
import session from 'express-session';
import SqliteStoreFactory from 'better-sqlite3-session-store';
import { config } from './config.js';
import { db } from './db/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';
import subtasksRouter from './routes/subtasks.js';

const SqliteStore = SqliteStoreFactory(session);

// Builds the Express app but does NOT start listening — this lets tests
// import the app and drive it with supertest without binding a port.
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json());

  const sessionOptions = {
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production', // requires HTTPS in production
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    },
  };
  // Persist sessions in the SQLite file (same DB, no extra service). Tests use
  // the default in-memory store to avoid touching disk.
  if (config.nodeEnv !== 'test') {
    sessionOptions.store = new SqliteStore({
      client: db,
      expired: { clear: true, intervalMs: 1000 * 60 * 15 },
    });
  }
  app.use(session(sessionOptions));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:projectId/tasks', tasksRouter);
  app.use('/api/tasks/:taskId/subtasks', subtasksRouter);

  // 404 for unknown API routes, then the central error handler (must be last).
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
