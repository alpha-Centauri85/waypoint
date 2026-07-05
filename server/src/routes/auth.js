import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, getUserByEmail, getUserById } from '../models/users.js';
import { badRequest, conflict, unauthorized } from '../lib/errors.js';

const router = Router();

function publicUser(user) {
  return { id: user.id, email: user.email };
}

router.post('/register', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw badRequest('email and password are required');
  if (password.length < 8) throw badRequest('password must be at least 8 characters');
  if (getUserByEmail(email)) throw conflict('email already registered');
  const user = createUser(email, bcrypt.hashSync(password, 10));
  req.session.userId = user.id;
  res.status(201).json(publicUser(user));
});

router.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw badRequest('email and password are required');
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
