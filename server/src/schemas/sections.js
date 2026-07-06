import { z } from 'zod';

const name = z.string().trim().min(1, 'is required').max(120, 'is too long');

export const createSectionSchema = z.object({ name });

export const updateSectionSchema = z.object({ name: name.optional() });

export const reorderSectionsSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});
