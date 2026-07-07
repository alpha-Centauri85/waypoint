import { z } from 'zod';

// Colours a status may use (Mantine palette names that read on the dark UI).
export const STATUS_COLORS = [
  'gray',
  'teal',
  'amber',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'cyan',
  'indigo',
  'violet',
  'grape',
  'pink',
];

const name = z.string().trim().min(1, 'is required').max(40, 'is too long');
const color = z.enum(STATUS_COLORS);

export const createStatusSchema = z.object({
  name,
  color: color.optional(),
  isDone: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  name: name.optional(),
  color: color.optional(),
  isDone: z.boolean().optional(),
});

export const reorderStatusesSchema = z.object({
  orderedIds: z.array(z.number().int().positive()).min(1),
});
