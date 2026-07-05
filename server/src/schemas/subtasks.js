import { z } from 'zod';

const title = z.string().trim().min(1, 'is required').max(500, 'is too long');

export const createSubtaskSchema = z.object({
  title,
});

// PATCH: rename and/or toggle done; both optional.
export const updateSubtaskSchema = z.object({
  title: title.optional(),
  done: z.boolean().optional(),
});
