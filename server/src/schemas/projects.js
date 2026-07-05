import { z } from 'zod';

const name = z.string().trim().min(1, 'is required').max(200, 'is too long');
const description = z.string().trim().max(2000, 'is too long').nullish();

export const createProjectSchema = z.object({
  name,
  description,
});

// PATCH: every field is optional (send only what changes), but a supplied name
// must still be non-empty.
export const updateProjectSchema = z.object({
  name: name.optional(),
  description,
});
