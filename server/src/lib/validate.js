import { ZodError } from 'zod';
import { badRequest } from './errors.js';

// Turn a ZodError into a single human-readable sentence, e.g.
// "title: is required; status: Invalid option: expected one of ...".
function formatZodError(error) {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

// Middleware factory: validate (and normalize) the request body against a zod
// schema. On success `req.body` is replaced with the parsed result — coerced,
// with unknown keys stripped and defaults applied — so route handlers can trust
// their inputs. On failure it throws a 400 HttpError describing what was wrong,
// which the central errorHandler formats. This is the single place request
// bodies are validated; routes no longer hand-check fields.
export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) throw badRequest(formatZodError(err));
      throw err;
    }
  };
}
