import { z } from 'zod';

const title = z.string().trim().min(1, 'is required').max(500, 'is too long');
// A subtask's status is one of the project OWNER's per-user statuses (validated
// against ownership in the route). Ids are positive integers.
const statusId = z.number().int().positive();

export const createSubtaskSchema = z.object({
  title,
  statusId: statusId.optional(),
});

// PATCH: rename and/or set status; both optional. `done` is derived from the
// status server-side, so it isn't an accepted input.
export const updateSubtaskSchema = z.object({
  title: title.optional(),
  statusId: statusId.optional(),
});
