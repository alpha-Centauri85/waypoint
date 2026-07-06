import { z } from 'zod';

// Colours a label may use — Mantine palette names that render on the dark UI.
export const LABEL_COLORS = [
  'teal',
  'amber',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'grape',
  'pink',
  'gray',
];

const name = z.string().trim().min(1, 'is required').max(40, 'is too long');
const color = z.enum(LABEL_COLORS);

export const createLabelSchema = z.object({
  name,
  color: color.optional(),
});

export const updateLabelSchema = z.object({
  name: name.optional(),
  color: color.optional(),
});
