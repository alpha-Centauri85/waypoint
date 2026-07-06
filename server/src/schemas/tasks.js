import { z } from 'zod';

const title = z.string().trim().min(1, 'is required').max(500, 'is too long');
const status = z.enum(['todo', 'doing', 'done']);
// 0 none · 1 low · 2 medium · 3 high · 4 urgent
const priority = z.number().int().min(0, 'is out of range').max(4, 'is out of range');
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
  priority: priority.optional(),
});

// PATCH: every field optional; a supplied title must still be non-empty.
export const updateTaskSchema = z.object({
  title: title.optional(),
  status: status.optional(),
  dueDate,
  notes,
  priority: priority.optional(),
});

// Reorder: the full set of the project's task ids in their new order.
export const reorderTasksSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});
