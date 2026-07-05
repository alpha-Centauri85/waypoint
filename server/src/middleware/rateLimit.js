import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { tooManyRequests } from '../lib/errors.js';

// Build a rate limiter that funnels rejections through our central error handler
// (so a 429 returns the same `{ error }` JSON shape as every other error).
export function makeRateLimiter({ windowMs, max, message, skip }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7', // RateLimit-* headers
    legacyHeaders: false,
    skip,
    handler: (req, res, next) => next(tooManyRequests(message)),
  });
}

// Guards the auth endpoints (login/register are the brute-force surface).
// Disabled under test so suites that make many auth calls don't hit the limit.
export const authLimiter = makeRateLimiter({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.max,
  message: 'Too many attempts, please try again later',
  skip: () => config.nodeEnv === 'test',
});
