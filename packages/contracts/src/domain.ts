import { z } from 'zod';

export const DecimalByteStringSchema = z.string().regex(/^(0|[1-9]\d*)$/);
export const RuntimeModeSchema = z.enum(['installed', 'rescue']);
export const SourceKindSchema = z.enum(['physical_device', 'raw_image', 'ewf_image', 'memory_image']);
export const CapabilityLevelSchema = z.enum([
  'supported', 'limited', 'unsupported', 'requires_rescue_mode', 'requires_elevation', 'requires_unlock',
]);
export const RecoveryGoalSchema = z.enum([
  'recently_deleted', 'specific_target', 'recover_everything', 'partition_loss', 'damaged_device', 'memory_analysis',
]);
export const ScanPresetSchema = z.enum(['quick', 'full', 'advanced']);
/** Coarse file families the carving engines search for; mirrors the daemon's `FileFamily`. */
export const FileFamilySchema = z.enum(['images', 'documents', 'archives', 'audio_video', 'databases', 'executables']);
export const JobStageSchema = z.enum([
  'draft', 'preflight', 'waiting_for_destination', 'acquiring', 'verifying_image',
  'partition_scan', 'metadata_scan', 'carving', 'validating', 'threat_scan', 'indexing',
  'review_ready', 'exporting', 'reporting', 'completed', 'paused', 'needs_attention',
  'cancelling', 'cancelled', 'failed',
]);

export const CapabilityFindingSchema = z.object({
  code: z.string().min(1),
  level: CapabilityLevelSchema,
  title: z.string().min(1),
  explanation: z.string().min(1),
  recommendedAction: z.string().min(1).nullable(),
});

export const SourceDescriptorSchema = z.object({
  sourceId: z.string().min(1),
  kind: SourceKindSchema,
  displayName: z.string().min(1),
  stableId: z.string().min(1),
  sizeBytes: DecimalByteStringSchema,
  logicalSectorSize: z.number().int().positive().nullable(),
  physicalSectorSize: z.number().int().positive().nullable(),
  bus: z.string().nullable(),
  model: z.string().nullable(),
  serialRedacted: z.string().nullable(),
  systemDisk: z.boolean(),
  mountedReadWrite: z.boolean(),
  encryptedState: z.enum(['none', 'locked', 'unlocked', 'unknown']),
  health: z.enum(['healthy', 'warning', 'failing', 'unknown']),
  capabilities: z.array(CapabilityFindingSchema),
});

export const RecoveryCaseSchema = z.object({
  caseId: z.string().min(1),
  title: z.string().min(3).max(120),
  operator: z.string().min(1),
  referenceNumber: z.string().nullable(),
  organization: z.string().nullable(),
  workspacePath: z.string().min(1),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const RecoveryJobSchema = z.object({
  jobId: z.string().min(1), caseId: z.string().min(1), sourceId: z.string().min(1),
  goal: RecoveryGoalSchema, preset: ScanPresetSchema, stage: JobStageSchema,
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
});

export const RecoveryArtifactSchema = z.object({
  artifactId: z.string().min(1), sourceId: z.string().min(1), partitionId: z.string().nullable(),
  originalName: z.string().nullable(), originalPath: z.string().nullable(), displayName: z.string().min(1),
  extension: z.string().nullable(), mimeType: z.string().nullable(), sizeBytes: DecimalByteStringSchema,
  recoveryMethod: z.enum(['metadata', 'carving', 'allocated_export']),
  recoveryState: z.enum(['complete_validated', 'complete_unverified', 'partial_validated', 'partial_unverified', 'corrupt']),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  sourceRanges: z.array(z.object({ offset: DecimalByteStringSchema, length: DecimalByteStringSchema })),
  threatStatus: z.enum(['no_rule_match', 'potential_threat', 'scan_error', 'not_scanned']),
  previewStatus: z.enum(['safe_preview', 'blocked', 'unsupported']),
});

export type RuntimeMode = z.infer<typeof RuntimeModeSchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
export type CapabilityLevel = z.infer<typeof CapabilityLevelSchema>;
export type RecoveryGoal = z.infer<typeof RecoveryGoalSchema>;
export type ScanPreset = z.infer<typeof ScanPresetSchema>;
export type FileFamily = z.infer<typeof FileFamilySchema>;
export type JobStage = z.infer<typeof JobStageSchema>;
export type CapabilityFinding = z.infer<typeof CapabilityFindingSchema>;
export type SourceDescriptor = z.infer<typeof SourceDescriptorSchema>;
export type RecoveryCase = z.infer<typeof RecoveryCaseSchema>;
export type RecoveryJob = z.infer<typeof RecoveryJobSchema>;
export type RecoveryArtifact = z.infer<typeof RecoveryArtifactSchema>;
