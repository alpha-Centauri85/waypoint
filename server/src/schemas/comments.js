import { z } from 'zod';

const body = z.string().trim().min(1, 'is required').max(10000, 'is too long');

export const createCommentSchema = z.object({ body });
export const updateCommentSchema = z.object({ body });
