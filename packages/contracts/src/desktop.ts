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
export const WORKSPACE_TREE_MAX_DEPTH = 3;
export const WORKSPACE_TREE_MAX_ENTRIES = 200;
export interface WorkspaceDirectoryEntry {
  name: string;
  relativePath: string;
  children: WorkspaceDirectoryEntry[];
  childrenOmitted: boolean;
}
export const WorkspaceRelativePathSchema = z.string().min(1).refine((relativePath) => {
  if (relativePath.includes('\\') || relativePath.startsWith('/') || /^[A-Za-z]:/.test(relativePath)) return false;
  const segments = relativePath.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}, 'Workspace directory paths must be normalized relative paths without parent or root escapes.');
export const WorkspaceDirectoryEntrySchema: z.ZodType<WorkspaceDirectoryEntry> = z.lazy(() => z.object({
  name: z.string().min(1),
  relativePath: WorkspaceRelativePathSchema,
  children: z.array(WorkspaceDirectoryEntrySchema),
  childrenOmitted: z.boolean(),
}).strict());
export const WorkspaceSelectionSchema = z.object({
  selectedPath: z.string().min(1),
  rootPath: z.string().min(1),
  rootLabel: z.string().min(1),
  totalBytes: DecimalByteStringSchema,
  freeBytes: DecimalByteStringSchema,
  directories: z.array(WorkspaceDirectoryEntrySchema),
  truncated: z.boolean(),
}).strict().superRefine((selection, context) => {
  let count = 0;
  const visit = (entries: WorkspaceDirectoryEntry[], depth: number): void => {
    for (const entry of entries) {
      count += 1;
      if (depth > WORKSPACE_TREE_MAX_DEPTH) {
        context.addIssue({ code: 'custom', message: `Workspace directory tree exceeds depth ${WORKSPACE_TREE_MAX_DEPTH}.` });
        return;
      }
      visit(entry.children, depth + 1);
    }
  };
  visit(selection.directories, 1);
  if (count > WORKSPACE_TREE_MAX_ENTRIES) {
    context.addIssue({ code: 'custom', message: `Workspace directory tree exceeds ${WORKSPACE_TREE_MAX_ENTRIES} entries.` });
  }
});
export const WorkspaceFolderResultSchema = WorkspaceSelectionSchema.nullable();
export const ExportFolderResultSchema = z.string().min(1).nullable();
export const SourceImageResultSchema = z.string().min(1).nullable();
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
  // Source filesystem sensitivity is not typed, so folder prefixes use SQLite NOCASE segment semantics on every platform to support the approved Windows flow.
  originalPathPrefix: z.string().transform((value) => value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/')).pipe(z.string().min(1)).optional(),
  minSize: z.number().int().nonnegative().optional(), maxSize: z.number().int().nonnegative().optional(),
  cursor: z.string().optional(), pageSize: z.number().int().min(1).max(500),
});
export const ArtifactPageSchema = z.object({
  items: z.array(RecoveryArtifactSchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
});
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
export const CaseStateSchema = z.object({
  sourceId: z.string().min(1).nullable(), latestJobId: z.string().min(1).nullable(),
}).strict().superRefine((state, context) => {
  if (state.latestJobId && !state.sourceId) context.addIssue({ code: 'custom', message: 'A persisted job must identify its source.' });
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
  artifactIds: z.array(z.string().min(1)).min(1), destinationPath: z.string().min(1), acknowledgeUnsafe: z.boolean(),
}).strict();
export const EmptyParamsSchema = z.object({}).strict();
export const CaseOpenParamsSchema = z.object({ casePath: z.string().min(1) }).strict();
export const SourceParamsSchema = z.object({ sourceId: z.string().min(1) }).strict();
export const JobParamsSchema = z.object({ jobId: z.string().min(1) }).strict();
export const JobEventsParamsSchema = JobParamsSchema.extend({ afterSequence: z.number().int().nonnegative() }).strict();
export const ArtifactParamsSchema = z.object({ artifactId: z.string().min(1) }).strict();
export const ReportParamsSchema = z.object({ caseId: z.string().min(1) }).strict();
export const ReportRevealParamsSchema = z.object({ reportPath: z.string().min(1) }).strict();
export const ReportRevealResultSchema = z.object({ revealed: z.literal(true) }).strict();
export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;
export type AddImageSourceInput = z.infer<typeof AddImageSourceInputSchema>;
export type CreateRecoveryJobInput = z.infer<typeof CreateRecoveryJobInputSchema>;
export type ArtifactQuery = z.infer<typeof ArtifactQuerySchema>;
export type ExportArtifactsInput = z.infer<typeof ExportArtifactsInputSchema>;
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;
export type WorkspaceSelection = z.infer<typeof WorkspaceSelectionSchema>;
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
export type CaseState = z.infer<typeof CaseStateSchema>;

export interface RecoveryDesktopApi {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  chooseWorkspaceFolder(): Promise<WorkspaceSelection | null>;
  chooseExportFolder(): Promise<string | null>;
  chooseSourceImage(): Promise<string | null>;
  createCase(input: CreateCaseInput): Promise<z.infer<typeof RecoveryCaseSchema>>;
  openCase(casePath: string): Promise<z.infer<typeof RecoveryCaseSchema>>;
  getCaseState(): Promise<CaseState>;
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
  revealReportInFolder(reportPath: string): Promise<void>;
  subscribeJobEvents(listener: (event: z.infer<typeof JobEventSchema>) => void): () => void;
}

export function parseDesktopRpcParams(method: string, params: unknown): Record<string, unknown> {
  switch (method) {
    case 'runtime.get': case 'case.state': case 'source.list': return EmptyParamsSchema.parse(params);
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
    case 'case.state': return CaseStateSchema.parse(result);
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
