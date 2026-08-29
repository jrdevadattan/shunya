import { z } from 'zod';
import { JobStageSchema } from './domain.js';

export const JobEventSchema = z.object({
  eventId: z.string().min(1),
  jobId: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  stage: JobStageSchema,
  occurredAt: z.string().datetime(),
  message: z.string().nullable(),
});

export type JobEvent = z.infer<typeof JobEventSchema>;
