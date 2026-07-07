import { z } from 'zod';

const role = z.enum(['editor', 'viewer']);

export const inviteSchema = z.object({ role });
export const memberRoleSchema = z.object({ role });
