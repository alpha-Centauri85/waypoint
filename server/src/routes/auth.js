import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail, getUserById, updateUserTheme } from '../models/users.js';
import { ensureStatuses } from '../models/statuses.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, updateMeSchema } from '../schemas/auth.js';

const router = Router();

function publicUser(user) {
  return { id: user.id, email: user.email, theme: user.theme };
}

// Rate-limit only the credential endpoints; /me (hit on every page load) and
// /logout are left unthrottled.
router.post('/register', authLimiter, validateBody(registerSchema), (req, res) => {
  const { email, password } = req.body;
  if (getUserByEmail(email)) throw conflict('email already registered');
  const user = createUser(email, bcrypt.hashSync(password, 10));
  req.session.userId = user.id;
  res.status(201).json(publicUser(user));
});

router.post('/login', authLimiter, validateBody(loginSchema), (req, res) => {
  const { email, password } = req.body;
  const user = getUserByEmail(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    throw unauthorized('invalid credentials');
  }
  req.session.userId = user.id;
  res.json(publicUser(user));
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

router.get('/me', (req, res) => {
  const user = req.session?.userId ? getUserById(req.session.userId) : null;
  if (!user) throw unauthorized('Not authenticated');
  // Seed default statuses + backfill legacy task statuses before the app loads,
  // so task fetches always have a status_id (no first-render race).
  ensureStatuses(user.id);
  res.json(publicUser(user));
});

// Update the signed-in user's preferences (currently just the colour scheme).
router.patch('/me', validateBody(updateMeSchema), (req, res) => {
  if (!req.session?.userId) throw unauthorized('Not authenticated');
  const user = updateUserTheme(req.session.userId, req.body.theme);
  res.json(publicUser(user));
});

export default router;
