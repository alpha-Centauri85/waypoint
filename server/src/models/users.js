import { db } from '../db/index.js';

const insert = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');
// Never select password_hash for the public shape.
const byId = db.prepare('SELECT id, email, theme, created_at FROM users WHERE id = ?');
const setTheme = db.prepare('UPDATE users SET theme = ? WHERE id = ?');

export function createUser(email, passwordHash) {
  const { lastInsertRowid } = insert.run(email, passwordHash);
  return getUserById(lastInsertRowid);
}

export function getUserByEmail(email) {
  return byEmail.get(email);
}

export function getUserById(id) {
  return byId.get(id);
}

export function updateUserTheme(id, theme) {
  setTheme.run(theme, id);
  return getUserById(id);
}
