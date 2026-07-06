import { z } from 'zod';

const name = z.string().trim().min(1, 'is required').max(200, 'is too long');
const description = z.string().trim().max(2000, 'is too long').nullish();
const labelIds = z.array(z.number().int().positive());

export const createProjectSchema = z.object({
  name,
  description,
  labelIds: labelIds.optional(),
});

// PATCH: every field is optional (send only what changes), but a supplied name
// must still be non-empty.
export const updateProjectSchema = z.object({
  name: name.optional(),
  description,
  labelIds: labelIds.optional(),
});
