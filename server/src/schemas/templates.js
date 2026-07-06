import { z } from 'zod';

const name = z.string().trim().min(1, 'is required').max(200, 'is too long');

// Save an existing project as a template.
export const fromProjectSchema = z.object({
  projectId: z.number().int().positive(),
  name,
});

// Create a new project from a template.
export const instantiateSchema = z.object({ name });
