import { z } from 'zod';

export const RpcMethodSchema = z.enum([
  'runtime.get', 'case.create', 'case.open', 'source.list', 'source.add_image', 'source.assess',
  'job.create', 'job.start', 'job.pause', 'job.resume', 'job.cancel', 'artifact.query',
  'job.status', 'job.events', 'artifact.get', 'artifact.preview', 'export.start', 'report.generate',
]);
export const RpcRequestSchema = z.object({
  id: z.string().uuid(), method: RpcMethodSchema, params: z.record(z.string(), z.unknown()),
});
export const RpcResponseSchema = z.object({ kind: z.literal('response'), id: z.string().uuid(), result: z.unknown() });
export const RpcErrorSchema = z.object({
  kind: z.literal('error'), id: z.string().uuid(),
  error: z.object({ code: z.string().min(1), message: z.string().min(1) }),
});
export const RpcEventSchema = z.object({
  kind: z.literal('event'), topic: z.enum(['job.event', 'source.event', 'daemon.health']), payload: z.unknown(),
});
export const RpcFrameSchema = z.union([RpcResponseSchema, RpcErrorSchema, RpcEventSchema]);

export type RpcMethod = z.infer<typeof RpcMethodSchema>;
export type RpcRequest = z.infer<typeof RpcRequestSchema>;
export type RpcResponse = z.infer<typeof RpcResponseSchema>;
export type RpcError = z.infer<typeof RpcErrorSchema>;
export type RpcEvent = z.infer<typeof RpcEventSchema>;
export type RpcFrame = z.infer<typeof RpcFrameSchema>;
