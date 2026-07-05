// Helpers for signalling HTTP errors from route handlers. Throw one of these
// (or pass it to next()) and the central errorHandler formats the response, so
// routes don't repeat res.status(...).json(...) for every failure case.

export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export const badRequest = (message = 'Bad request') => new HttpError(400, message);
export const unauthorized = (message = 'Not authenticated') => new HttpError(401, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const conflict = (message = 'Conflict') => new HttpError(409, message);
export const tooManyRequests = (message = 'Too many requests') => new HttpError(429, message);

// Wrap an async route handler so a rejected promise reaches the error handler.
// (Express already forwards *synchronous* throws automatically; our current
// handlers are sync, but this is here for when async handlers are added.)
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
