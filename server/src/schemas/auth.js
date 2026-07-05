import { z } from 'zod';

// Emails are trimmed and lower-cased before validation so lookups are
// case-insensitive and consistent between register and login.
const email = z.string().trim().toLowerCase().pipe(z.email('must be a valid email'));

export const registerSchema = z.object({
  email,
  password: z.string().min(8, 'must be at least 8 characters'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'is required'),
});
