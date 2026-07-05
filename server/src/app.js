import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import healthRouter from './routes/health.js';

// Builds the Express app but does NOT start listening — this lets tests
// import the app and drive it with supertest without binding a port.
export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json());

  // Mount resource routers under /api/<name>.
  app.use('/api/health', healthRouter);

  // 404 for unknown API routes.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
