import { db } from '../db/index.js';

const insert = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
const byEmail = db.prepare('SELECT * FROM users WHERE email = ?');
// Never select password_hash for the public shape.
const byId = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?');

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
