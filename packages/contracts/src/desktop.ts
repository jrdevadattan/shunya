import { z } from 'zod';
import {
  CapabilityFindingSchema,
  DecimalByteStringSchema,
  JobStageSchema,
  RecoveryArtifactSchema,
  RecoveryCaseSchema,
  RecoveryGoalSchema,
  RecoveryJobSchema,
  RuntimeModeSchema,
  ScanPresetSchema,
  SourceDescriptorSchema,
} from './domain.js';
import { JobEventSchema } from './events.js';

export const RuntimeInfoSchema = z.object({ mode: RuntimeModeSchema });
export const SourceAssessmentSchema = z.object({
  sourceId: z.string().min(1),
  decision: z.enum(['ready', 'warning', 'blocked']),
  requiresAcknowledgement: z.boolean(),
  findings: z.array(CapabilityFindingSchema),
});
export const CapabilityLimitationSchema = z.object({
  code: z.string().min(1),
  stage: JobStageSchema,
  level: z.enum(['supported', 'limited', 'unsupported', 'requires_rescue_mode', 'requires_elevation', 'requires_unlock']),
  explanation: z.string().min(1),
  recommendedAction: z.string().nullable(),
});
export const PartitionDescriptorSchema = z.object({
  partitionId: z.string().min(1), index: z.number().int().positive(),
  startSector: DecimalByteStringSchema, sectorCount: DecimalByteStringSchema,
  startOffsetBytes: DecimalByteStringSchema, lengthBytes: DecimalByteStringSchema,
  partitionType: z.string().min(1), filesystem: z.string().nullable(), label: z.string().nullable(),
});
export const PartitionCandidateSchema = z.object({
  startSector: DecimalByteStringSchema, startOffsetBytes: DecimalByteStringSchema,
  filesystem: z.string().nullable(), confidence: z.string().min(1), source: z.string().min(1),
});
export const PartitionScanResultSchema = z.object({
  sectorSize: z.number().int().positive(), partitions: z.array(PartitionDescriptorSchema),
  candidates: z.array(PartitionCandidateSchema), gaps: z.array(z.tuple([DecimalByteStringSchema, DecimalByteStringSchema])),
  rawToolOutput: z.string().nullable(), toolVersion: z.string().nullable(),
});
export const JobStatusSchema = RecoveryJobSchema.extend({
  limitations: z.array(CapabilityLimitationSchema),
  partitions: PartitionScanResultSchema.nullable(),
});
export const ArtifactQuerySchema = z.object({
  search: z.string().optional(), method: z.string().optional(), status: z.string().optional(),
  threat: z.string().optional(), mimeType: z.string().optional(), partitionId: z.string().optional(),
  minSize: z.number().int().nonnegative().optional(), maxSize: z.number().int().nonnegative().optional(),
  cursor: z.string().optional(), pageSize: z.number().int().min(1).max(500),
});
export const ArtifactPageSchema = z.object({ items: z.array(RecoveryArtifactSchema), nextCursor: z.string().nullable() });
export const PreviewDescriptorSchema = z.object({
  artifactId: z.string().min(1), status: z.enum(['safe_preview', 'blocked', 'unsupported']),
  policy: z.string().min(1), detectedMimeType: z.string().nullable(), derivativePath: z.string().nullable(),
});
export const ExportItemResultSchema = z.object({
  artifactId: z.string().min(1), outputPath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/), verified: z.boolean(),
});
export const ExportJobSchema = z.object({ exportId: z.string().min(1), items: z.array(ExportItemResultSchema) });
export const ReportDescriptorSchema = z.object({
  caseId: z.string().min(1), jsonPath: z.string().min(1), markdownPath: z.string().min(1),
  limitations: z.array(CapabilityLimitationSchema),
});

export const CreateCaseInputSchema = z.object({
  title: z.string().min(3).max(120), operator: z.string().min(1), referenceNumber: z.string().nullable(), organization: z.string().nullable(),
  workspacePath: z.string().min(1), notes: z.string().nullable(), estimatedRequiredBytes: z.number().int().nonnegative().optional(),
});
export const AddImageSourceInputSchema = z.object({ path: z.string().min(1) });
export const CreateRecoveryJobInputSchema = z.object({
  caseId: z.string().min(1), sourceId: z.string().min(1), goal: RecoveryGoalSchema, preset: ScanPresetSchema,
});
export const ExportArtifactsInputSchema = z.object({
  artifactIds: z.array(z.string().min(1)).min(1), destinationPath: z.string().min(1), destinationPhysicalId: z.string().min(1), acknowledgeUnsafe: z.boolean(),
});
export const EmptyParamsSchema = z.object({}).strict();
export const CaseOpenParamsSchema = z.object({ casePath: z.string().min(1) }).strict();
export const SourceParamsSchema = z.object({ sourceId: z.string().min(1) }).strict();
export const JobParamsSchema = z.object({ jobId: z.string().min(1) }).strict();
export const JobEventsParamsSchema = JobParamsSchema.extend({ afterSequence: z.number().int().nonnegative() }).strict();
export const ArtifactParamsSchema = z.object({ artifactId: z.string().min(1) }).strict();
export const ReportParamsSchema = z.object({ caseId: z.string().min(1) }).strict();
export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;
export type AddImageSourceInput = z.infer<typeof AddImageSourceInputSchema>;
export type CreateRecoveryJobInput = z.infer<typeof CreateRecoveryJobInputSchema>;
export type ArtifactQuery = z.infer<typeof ArtifactQuerySchema>;
export type ExportArtifactsInput = z.infer<typeof ExportArtifactsInputSchema>;
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;
export type SourceAssessment = z.infer<typeof SourceAssessmentSchema>;
export type CapabilityLimitation = z.infer<typeof CapabilityLimitationSchema>;
export type PartitionDescriptor = z.infer<typeof PartitionDescriptorSchema>;
export type PartitionCandidate = z.infer<typeof PartitionCandidateSchema>;
export type PartitionScanResult = z.infer<typeof PartitionScanResultSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type ArtifactPage = z.infer<typeof ArtifactPageSchema>;
export type PreviewDescriptor = z.infer<typeof PreviewDescriptorSchema>;
export type ExportJob = z.infer<typeof ExportJobSchema>;
export type ReportDescriptor = z.infer<typeof ReportDescriptorSchema>;

export interface RecoveryDesktopApi {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  createCase(input: CreateCaseInput): Promise<z.infer<typeof RecoveryCaseSchema>>;
  openCase(casePath: string): Promise<z.infer<typeof RecoveryCaseSchema>>;
  listSources(): Promise<z.infer<typeof SourceDescriptorSchema>[]>;
  addImageSource(input: AddImageSourceInput): Promise<z.infer<typeof SourceDescriptorSchema>>;
  assessSource(sourceId: string): Promise<SourceAssessment>;
  createRecoveryJob(input: CreateRecoveryJobInput): Promise<z.infer<typeof RecoveryJobSchema>>;
  startJob(jobId: string): Promise<JobStatus>;
  pauseJob(jobId: string): Promise<JobStatus>;
  resumeJob(jobId: string): Promise<JobStatus>;
  cancelJob(jobId: string): Promise<JobStatus>;
  getJobStatus(jobId: string): Promise<JobStatus>;
  listJobEvents(jobId: string, afterSequence?: number): Promise<z.infer<typeof JobEventSchema>[]>;
  queryArtifacts(query: ArtifactQuery): Promise<ArtifactPage>;
  getArtifact(artifactId: string): Promise<z.infer<typeof RecoveryArtifactSchema>>;
  requestPreview(artifactId: string): Promise<PreviewDescriptor>;
  exportArtifacts(input: ExportArtifactsInput): Promise<ExportJob>;
  generateReport(caseId: string): Promise<ReportDescriptor>;
  subscribeJobEvents(listener: (event: z.infer<typeof JobEventSchema>) => void): () => void;
}

export function parseDesktopRpcParams(method: string, params: unknown): Record<string, unknown> {
  switch (method) {
    case 'runtime.get': case 'source.list': return EmptyParamsSchema.parse(params);
    case 'case.create': return CreateCaseInputSchema.parse(params);
    case 'case.open': return CaseOpenParamsSchema.parse(params);
    case 'source.add_image': return AddImageSourceInputSchema.parse(params);
    case 'source.assess': return SourceParamsSchema.parse(params);
    case 'job.create': return CreateRecoveryJobInputSchema.parse(params);
    case 'job.start': case 'job.pause': case 'job.resume': case 'job.cancel': case 'job.status': return JobParamsSchema.parse(params);
    case 'job.events': return JobEventsParamsSchema.parse(params);
    case 'artifact.query': return ArtifactQuerySchema.parse(params);
    case 'artifact.get': case 'artifact.preview': return ArtifactParamsSchema.parse(params);
    case 'export.start': return ExportArtifactsInputSchema.parse(params);
    case 'report.generate': return ReportParamsSchema.parse(params);
    default: throw new Error(`Unsupported desktop RPC method: ${method}`);
  }
}

export function parseDesktopRpcResult(method: string, result: unknown): unknown {
  switch (method) {
    case 'runtime.get': return RuntimeInfoSchema.parse(result);
    case 'case.create': case 'case.open': return RecoveryCaseSchema.parse(result);
    case 'source.list': return SourceDescriptorSchema.array().parse(result);
    case 'source.add_image': return SourceDescriptorSchema.parse(result);
    case 'source.assess': return SourceAssessmentSchema.parse(result);
    case 'job.create': return RecoveryJobSchema.parse(result);
    case 'job.start': case 'job.pause': case 'job.resume': case 'job.cancel': case 'job.status': return JobStatusSchema.parse(result);
    case 'job.events': return JobEventSchema.array().parse(result);
    case 'artifact.query': return ArtifactPageSchema.parse(result);
    case 'artifact.get': return RecoveryArtifactSchema.parse(result);
    case 'artifact.preview': return PreviewDescriptorSchema.parse(result);
    case 'export.start': return ExportJobSchema.parse(result);
    case 'report.generate': return ReportDescriptorSchema.parse(result);
    default: throw new Error(`Unsupported desktop RPC method: ${method}`);
  }
}
