import { z } from 'zod';
import { blueprintTask } from './templates.js';

const name = z.string().trim().min(1, 'is required').max(120, 'is too long');
const labelIds = z.array(z.number().int().positive());
const tasks = z.array(blueprintTask);

export const createModuleSchema = z.object({
  name,
  labelIds: labelIds.optional(),
  tasks: tasks.optional(),
});

// PATCH: all optional — omitted fields are left as-is.
export const updateModuleSchema = z.object({
  name: name.optional(),
  labelIds: labelIds.optional(),
  tasks: tasks.optional(),
});

export const bulkCreateSchema = z.object({
  names: z.array(name).min(1),
});
