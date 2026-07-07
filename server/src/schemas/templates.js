import { z } from 'zod';

const name = z.string().trim().min(1, 'is required').max(200, 'is too long');
const moduleName = z.string().trim().min(1, 'is required').max(120, 'is too long');
const description = z.string().trim().max(2000, 'is too long').nullish();

const moduleTask = z.object({
  title: z.string().trim().min(1, 'is required').max(500, 'is too long'),
  status: z.enum(['todo', 'doing', 'done']).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  notes: z.string().trim().max(10000, 'is too long').nullish(),
});

const module = z.object({
  name: moduleName,
  tasks: z.array(moduleTask).optional(),
});

// Create a template from an explicit structure (blank or authored).
export const createTemplateSchema = z.object({
  name,
  description,
  modules: z.array(module).optional(),
});

// Replace a template's name/description and whole module structure.
export const updateTemplateSchema = createTemplateSchema;

// Save an existing project as a template.
export const fromProjectSchema = z.object({
  projectId: z.number().int().positive(),
  name,
});

// Create a new project from a template.
export const instantiateSchema = z.object({ name });
