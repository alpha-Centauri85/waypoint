import { config } from '../config.js';

// 404 for API routes that matched no handler. Registered after all routers.
export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// Central error handler. Must be registered LAST and keep all four arguments so
// Express recognises it as an error handler.
export function errorHandler(err, req, res, _next) {
  // Malformed JSON body from express.json().
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Errors that already carry a client-error status (our HttpError, etc.).
  const status = err.statusCode || err.status;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message });
  }

  // SQLite constraint violations (unique, check, foreign key, ...).
  if (typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ error: 'Request violates a data constraint' });
  }

  // Anything else is unexpected: log it server-side and return a generic message
  // so internals (stack traces, SQL) never leak to the client.
  console.error('Unhandled error:', err);
  const body = { error: 'Internal server error' };
  if (config.nodeEnv !== 'production') body.detail = err.message;
  res.status(500).json(body);
}
