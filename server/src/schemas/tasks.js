import { z } from 'zod';

const title = z.string().trim().min(1, 'is required').max(500, 'is too long');
const status = z.enum(['todo', 'doing', 'done']);
// Due dates are calendar dates (YYYY-MM-DD); stored as TEXT in SQLite.
const dueDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date (YYYY-MM-DD)')
  .nullish();
const notes = z.string().trim().max(10000, 'is too long').nullish();

export const createTaskSchema = z.object({
  title,
  status: status.optional(),
  dueDate,
  notes,
});

// PATCH: every field optional; a supplied title must still be non-empty.
export const updateTaskSchema = z.object({
  title: title.optional(),
  status: status.optional(),
  dueDate,
  notes,
});
