import { z } from 'zod';

const name = z.string().trim().min(1, 'is required').max(200, 'is too long');
const sectionName = z.string().trim().min(1, 'is required').max(120, 'is too long');
const description = z.string().trim().max(2000, 'is too long').nullish();

// Blueprint task: status is a key (todo/doing/done) mapped to the user's
// workflow on instantiate; subtasks are titles.
const blueprintTask = z.object({
  title: z.string().trim().min(1, 'is required').max(500, 'is too long'),
  status: z.enum(['todo', 'doing', 'done']).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  notes: z.string().trim().max(10000, 'is too long').nullish(),
  subtasks: z.array(z.string().trim().min(1).max(500)).optional(),
});

const section = z.object({
  name: sectionName,
  labelIds: z.array(z.number().int().positive()).optional(), // injection slots
  tasks: z.array(blueprintTask).optional(),
});

export const createTemplateSchema = z.object({
  name,
  description,
  sections: z.array(section).optional(),
});

export const updateTemplateSchema = createTemplateSchema;

export const fromProjectSchema = z.object({
  projectId: z.number().int().positive(),
  name,
});

export const instantiateSchema = z.object({ name });

// Shared blueprint-task shape for the module library.
export { blueprintTask };
