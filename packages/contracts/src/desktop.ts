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

export interface CreateCaseInput {
  title: string; operator: string; referenceNumber: string | null; organization: string | null;
  workspacePath: string; notes: string | null; estimatedRequiredBytes?: number;
}
export interface AddImageSourceInput { path: string }
export interface CreateRecoveryJobInput {
  caseId: string; sourceId: string; goal: z.infer<typeof RecoveryGoalSchema>; preset: z.infer<typeof ScanPresetSchema>;
}
export type ArtifactQuery = z.infer<typeof ArtifactQuerySchema>;
export interface ExportArtifactsInput {
  artifactIds: string[]; destinationPath: string; destinationPhysicalId: string; acknowledgeUnsafe: boolean;
}
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
