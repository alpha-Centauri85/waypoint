import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail, getUserById } from '../models/users.js';
import { conflict, unauthorized } from '../lib/errors.js';
import { validateBody } from '../lib/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.js';

const router = Router();

function publicUser(user) {
  return { id: user.id, email: user.email };
}

router.post('/register', validateBody(registerSchema), (req, res) => {
  const { email, password } = req.body;
  if (getUserByEmail(email)) throw conflict('email already registered');
  const user = createUser(email, bcrypt.hashSync(password, 10));
  req.session.userId = user.id;
  res.status(201).json(publicUser(user));
});

router.post('/login', validateBody(loginSchema), (req, res) => {
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
  res.json(publicUser(user));
});

export default router;
