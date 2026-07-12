import { z } from 'zod';

const name = z.string().trim().min(1, 'is required').max(120, 'is too long');
const description = z.string().trim().max(10000, 'is too long').nullish();

export const createSectionSchema = z.object({ name, description });

export const updateSectionSchema = z.object({ name: name.optional(), description });

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});
