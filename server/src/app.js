import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import SqliteStoreFactory from 'better-sqlite3-session-store';
import { config } from './config.js';
import { db } from './db/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import labelsRouter from './routes/labels.js';
import modulesRouter from './routes/modules.js';
import projectsRouter from './routes/projects.js';
import searchRouter from './routes/search.js';
import sectionsRouter from './routes/sections.js';
import statusesRouter from './routes/statuses.js';
import tasksRouter from './routes/tasks.js';
import templatesRouter from './routes/templates.js';
import subtasksRouter from './routes/subtasks.js';

const SqliteStore = SqliteStoreFactory(session);

// Builds the Express app but does NOT start listening — this lets tests
// import the app and drive it with supertest without binding a port.
export function createApp() {
  const app = express();

  // Behind a reverse proxy (production TLS), trust it so `secure` cookies are
  // set and req.ip reflects the real client for rate limiting.
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

  // Security response headers. When serving the client we apply a CSP tuned for
  // the SPA (self-hosted assets/fonts; Mantine needs inline styles). Otherwise
  // (API-only in dev/split deploy) leave CSP off so it doesn't fight the dev host.
  app.use(
    helmet({
      contentSecurityPolicy: config.serveClient
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"], // Mantine injects inline styles
              imgSrc: ["'self'", 'data:'],
              fontSrc: ["'self'"],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
            },
          }
        : false,
    }),
  );
  // CORS is only needed when the client is served from a different origin (dev,
  // or a split deploy). When Express serves the client, requests are same-origin.
  if (!config.serveClient) {
    app.use(cors({ origin: config.clientOrigin, credentials: true }));
  }
  app.use(express.json());

  const sessionOptions = {
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies, // requires HTTPS when true
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
  app.use('/api/labels', labelsRouter);
  app.use('/api/modules', modulesRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/statuses', statusesRouter);
  app.use('/api/templates', templatesRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/projects/:projectId/sections', sectionsRouter);
  app.use('/api/projects/:projectId/tasks', tasksRouter);
  app.use('/api/tasks/:taskId/subtasks', subtasksRouter);

  // 404 for unknown API routes (before the SPA fallback so /api/* never returns
  // index.html).
  app.use('/api', notFoundHandler);

  // In a single-origin production deploy, serve the built client and let the SPA
  // handle any non-API path.
  if (config.serveClient) {
    app.use(express.static(config.clientDist));
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  // Central error handler (must be last).
  app.use(errorHandler);

  return app;
}
