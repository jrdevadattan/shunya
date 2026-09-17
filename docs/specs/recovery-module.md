# SIH 26149 Recovery Module Product and Engineering Specification

## 0. Scope clarification

This specification covers **retrieval/recovery only**. It intentionally excludes secure file deletion, folder deletion, free-space wiping, whole-device sanitization, cryptographic erasure, and sanitization certificates.

The spoken instruction contained both “no deletion is necessary” and “work on the deletion properly.” Because the user explicitly stated that the current role is retrieval, this document treats “deletion” as a verbal slip and does not authorize Codex to implement destructive functionality.

The recovery module may create and remove its own temporary working files, but it must never modify the source device or attempt in-place repair.

## 1. Product definition

Build a government-oriented digital recovery platform with one brand and two operating modes:

- **Installed Mode:** Electron application on Windows, macOS, Debian-family Linux, and BOSS GNU/Linux.
- **Rescue Mode:** bootable x86-64 Debian-based ISO/USB containing the same application, recovery core, and forensic tools.

The platform supports two primary recovery goals:

1. **Specific recovery:** locate and recover a particular deleted file or folder when sufficient filesystem metadata or content remains.
2. **Whole-source recovery:** image an entire disk or volume and recover every file that can be supported by available metadata or validated carving.

“Whole-disk retrieval” means creating a bit-for-bit or best-effort image and extracting recoverable data. It does **not** mean promising to reconstruct overwritten sectors or returning a damaged disk to an identical historic state.

## 2. Strict feasibility boundaries

The product must be honest about these limits:

- Recovery after restart is often possible on magnetic disks when blocks have not been overwritten.
- SSD recovery may become impossible after TRIM and garbage collection. A failed recovery in this case is not necessarily a software defect.
- Metadata recovery can preserve original names, paths, timestamps, and structure when records survive.
- Signature carving can recover content when metadata is gone, but normally cannot prove the original filename or folder.
- A hash cannot reconstruct overwritten content.
- RAM acquisition changes a running system and is not perfectly non-invasive.
- Encrypted media requires an authorized key, recovery key, or already-unlocked source. Password cracking is outside scope.
- Unsupported filesystems, storage bridges, RAID layouts, or damaged hardware must produce explicit limited/unsupported outcomes rather than guessed results.
- No implementation can cover every future storage device or corrupted state. “All edge cases handled” means the app fails safely, explains the condition, preserves evidence, and offers a supported next action.

## 3. Primary users

### 3.1 Guided operator

A government employee who understands the case objective but may not know terms such as inode, MFT, partition offset, E01 segment, or unallocated cluster.

Needs:

- Plain-language workflow.
- Strong source/destination safety.
- Explanations beside warnings.
- A small number of recommended choices.
- Clear progress and recovery quality.

### 3.2 Forensic examiner

A trained investigator who needs:

- Source geometry and stable identifiers.
- Image and artifact hashes.
- Partition offsets and filesystem details.
- Recovery method and source byte ranges.
- Raw tool transcripts.
- Advanced filters and hex view.
- Reproducible reports.

### 3.3 Administrator

Responsible for deployment, offline updates, tool manifests, permissions, and BOSS/Windows/macOS packaging.

## 4. Product modes

### 4.1 Installed Mode

Use for:

- Opening raw, split, or E01 forensic images.
- Recovering from external disks when the operating system can expose the device read-only.
- Reviewing existing cases.
- Exporting results.
- Analyzing supported memory images.
- Demonstrations and training.

Restrictions:

- Current system disk recovery must show a high-severity warning.
- Deep recovery from the current system disk should be blocked by default and redirected to Rescue Mode.
- Physical-device acquisition may require elevation.
- A potentially compromised host cannot provide the same trust level as Rescue Mode.

### 4.2 Rescue Mode

Use for:

- Current system disk recovery.
- Compromised or unbootable hosts.
- Failing media.
- Read-only physical acquisition.
- Lost partitions.
- External RAID/LVM investigation where supported.

Boot behavior:

- x86-64 UEFI and legacy BIOS for MVP.
- No automatic mounting of discovered storage.
- Network disabled by default.
- The live root is read-only.
- A destination disk is selected explicitly.
- The same Electron UI auto-launches with a `Rescue Mode` badge.
- Apple Silicon boot is outside the MVP. Installed macOS mode remains supported for image review and limited acquisition.

## 5. Supported source types

### 5.1 Physical device

Examples: internal HDD, SATA SSD, NVMe SSD, external USB HDD/SSD, USB flash drive, memory card.

Required properties:

- Stable device identity.
- Model, serial where authorized, capacity, logical/physical sector size.
- Bus and connection type.
- Read-only/open state.
- System-disk and mounted-volume relationship.
- Health indicators when available.

### 5.2 Disk image

MVP:

- Raw `.img`, `.dd`, `.raw`.
- Split raw images such as `.001`, `.002` when explicitly selected.

Phase 2:

- E01/Ex01 through libewf.
- E01 segment verification and missing-segment detection.

### 5.3 Memory image

MVP analysis:

- Windows raw memory image supported by Volatility 3.
- Linux raw/LiME image when supported by symbols and plugins.

Acquisition later:

- WinPmem on Windows.
- AVML or LiME on Linux/BOSS.
- macOS live-memory acquisition is outside the MVP.

### 5.4 Logical folder

A folder is not a sufficient source for deleted-file recovery because deleted records and unallocated data belong to the containing filesystem. The UI may allow a folder to be entered as a **search target** after a filesystem source is selected, but it must not imply that scanning an accessible folder can recover all deleted children.

## 6. Recovery goals shown to users

Use plain-language cards:

1. **Recover recently deleted files**
   - Starts with filesystem metadata.
   - Best chance of original names and folders.

2. **Find a specific file or folder**
   - Accepts name, former path, type, size range, date range, and optional known hash.
   - If metadata is gone, transitions to targeted carving by file type.

3. **Recover everything possible**
   - Metadata scan followed by unallocated-space carving.
   - Longest runtime and largest destination requirement.

4. **Find data after formatting or partition loss**
   - Performs partition discovery and then filesystem/carving passes.
   - Never writes a recovered partition table to the source.

5. **Recover from a damaged device**
   - Rescue Mode only for MVP.
   - Images healthy regions first using ddrescue and a persistent mapfile.
   - Analyzes the image, not the unstable original.

6. **Analyze a memory image**
   - Separate flow; does not mix disk-file results with volatile-memory artifacts.

## 7. Scan presets

### Quick Scan

- Partition inventory.
- Filesystem detection.
- Deleted metadata records.
- No full unallocated-space carving.
- User message: “Fastest option. Best when the file was deleted recently and its file record still exists.”

### Full Scan

- Everything in Quick Scan.
- Unallocated-space carving for selected common file families.
- File validation, duplicate grouping, and threat scan.
- User message: “Searches remaining disk space when file records are missing. Original names may not be available.”

### Advanced Scan

- Partition candidates.
- User-selectable file families.
- Allocated and/or unallocated ranges.
- Sector ranges.
- Parser/tool selection.
- Fragment and validation thresholds.
- Intended for trained examiners.

## 8. Recommended support matrix

### 8.1 Operating systems

| Platform | Installed app | Raw physical source | Packaging | MVP status |
|---|---:|---:|---|---|
| Windows 10 22H2 x64 / Windows 11 x64 | Yes | Yes with elevation | Signed installer | Primary |
| BOSS GNU/Linux 10 x86-64 | Yes | Yes with polkit/root helper | `.deb` | Primary |
| Debian 12/13 x86-64 | Yes | Yes | `.deb`/AppImage | Primary |
| Ubuntu 24.04 x86-64 | Yes | Yes | `.deb`/AppImage | Secondary |
| macOS 13+ x64/arm64 | Yes | Limited physical acquisition | `.dmg` | Secondary |
| Rescue ISO x86-64 | Same UI | Yes | ISO/USB | Primary |
| Apple Silicon rescue boot | No | No | — | Outside MVP |

### 8.2 Filesystems

| Tier | Filesystems | Expected recovery behavior |
|---|---|---|
| Tier 1 | NTFS, FAT12/16/32, exFAT, ext2/3/4 | Metadata recovery, carving, path preservation where records survive |
| Tier 2 | HFS+, XFS, Btrfs, UFS | Best-effort through supported library/tool capability; clearly marked partial/experimental |
| Tier 3 | APFS, ReFS, unknown/proprietary | Image acquisition and raw carving; metadata recovery limited or unavailable |
| Special | BitLocker/LUKS/FileVault/encrypted containers | Require authorized unlock material or already-unlocked source; no cracking |

Do not hard-code a filesystem support claim only from a name. At runtime, record the exact tool/library capability and version used.

## 9. Recovery pipeline

### Stage 1 — Case creation

Create a case before analysis. Minimum fields:

- Case ID generated by the platform.
- User-supplied title.
- Operator display name or identifier.
- Optional organization/reference number.
- Destination workspace.
- Notes.

### Stage 2 — Source discovery

Discover devices without mounting them. Resolve:

- Physical device.
- Volumes/partitions.
- Mount state.
- System-disk relationship.
- Stable ID.
- Geometry.
- Encryption indicators.
- Health and read errors.

### Stage 3 — Safety preflight

Block or warn based on:

- Source equals destination physical device.
- Destination free space insufficient.
- Source is the active system disk.
- Source is writable/mounted read-write in Rescue Mode.
- Source identity changed after selection.
- Evidence image is incomplete.
- Destination is read-only or unreliable.
- Recovery output would overwrite an existing case unexpectedly.

### Stage 4 — Acquisition

Preferred rule: image first, analyze second.

Healthy source:

- Sequential read-only acquisition.
- Raw image in MVP.
- Concurrent SHA-256.
- Periodic checkpoints.
- Read-error ranges recorded.

Failing source:

- Rescue Mode ddrescue adapter.
- First pass copies healthy regions without repeated retries.
- Persistent mapfile enables resume.
- Additional retry passes are explicit.

Opening an existing image skips acquisition but verifies its identity/hash when available.

### Stage 5 — Partition discovery

- Parse GPT/MBR and known volume systems.
- List gaps/unallocated ranges.
- Detect inconsistent or missing partition structures.
- Invoke a read-only TestDisk discovery adapter only when normal parsing is insufficient.
- Store partition candidates; never write them to the source.

### Stage 6 — Metadata recovery

Use The Sleuth Kit or a versioned equivalent to enumerate:

- Allocated files.
- Deleted directory entries.
- Orphan records.
- File IDs/inodes.
- Paths when recoverable.
- Data runs/extents.
- Timestamps.
- Alternate data streams where supported.
- Sparse/compressed flags.

Recover content through a metadata address only when the record still maps valid data.

### Stage 7 — Signature carving

Use PhotoRec through a scripted adapter for unallocated ranges or full media when needed.

Rules:

- Destination is never the source.
- Selected file families are passed explicitly.
- Raw tool output directories remain internal.
- Each carved artifact is normalized into the case index.
- Invented filenames from the carver are not displayed as original names.
- Record byte ranges and signature family when available.

### Stage 8 — Validation and confidence

Validation is deterministic before ML:

- Magic/signature match.
- Length and boundary checks.
- Footer/terminator checks.
- Container parsing for ZIP-based Office formats.
- Checksums/indexes when the format provides them.
- Image decode probe.
- PDF structure probe.
- Archive listing without extraction to unsafe paths.

Assign one of:

- `COMPLETE_VALIDATED`
- `COMPLETE_UNVERIFIED`
- `PARTIAL_VALIDATED`
- `PARTIAL_UNVERIFIED`
- `CORRUPT`

Never show a numeric confidence without explaining its basis.

### Stage 9 — Threat classification

Run YARA-X against recovered artifacts. This is classification, not proof of safety.

Outcomes:

- `NO_RULE_MATCH`
- `POTENTIAL_THREAT`
- `SCAN_ERROR`
- `NOT_SCANNED`

Recovered active content remains quarantined even with no rule match.

### Stage 10 — Index and review

Index normalized result data in SQLite with FTS5 for:

- Names and paths.
- File types.
- Date ranges.
- Size ranges.
- Recovery method.
- Completeness.
- Threat status.
- Hashes.
- Source partition.

### Stage 11 — Export

- Destination must not resolve to the source physical device.
- Preserve original folder structure only when supported by metadata.
- Carved files go under `Recovered by type/<type>/` unless the user selects a different safe organization.
- Sanitize unsafe/reserved filenames.
- Prevent path traversal.
- Handle collisions deterministically.
- Hash exported files and compare them with indexed artifact hashes.

### Stage 12 — Report

Generate:

- Human-readable PDF/HTML later; Markdown/JSON in first vertical slice.
- Case summary.
- Source identity and geometry.
- Image hash.
- Tool versions and binary hashes.
- Recovery methods.
- Counts by status.
- Export manifest.
- Warnings and limitations.
- Source hash before/after when the source is an image file.

The data model must leave a `signature` field for the platform’s future certificate subsystem, but PKI implementation is not required in this recovery-only plan.

## 10. Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│ Electron Renderer: React/TypeScript                              │
│ Guided workflow, results, preview, filters, reports              │
│ No Node integration, no filesystem access, no tool execution     │
└──────────────────────────────┬───────────────────────────────────┘
                               │ typed preload API
┌──────────────────────────────▼───────────────────────────────────┐
│ Electron Main + Preload                                           │
│ Window lifecycle, secure IPC, dialogs, daemon supervision        │
│ Validates every request and sender                               │
└──────────────────────────────┬───────────────────────────────────┘
                               │ NDJSON RPC over inherited pipes
┌──────────────────────────────▼───────────────────────────────────┐
│ Rust recovery daemon                                               │
│ Domain rules, case store, job engine, indexing, adapters, reports│
│ Runs unprivileged after raw acquisition wherever possible        │
└───────────────┬────────────────────┬─────────────────────────────┘
                │                    │
                │                    └── Tool runner workers
                │                        TSK / TestDisk / PhotoRec /
                │                        YARA-X / Volatility / libewf
                │
┌───────────────▼──────────────────────────────────────────────────┐
│ Privileged helper                                                  │
│ Device inventory, read-only raw open, acquisition                 │
│ Windows service / Linux polkit helper / macOS helper              │
└──────────────────────────────────────────────────────────────────┘
```

## 11. Why Electron must not contain the recovery engine

The renderer processes untrusted filenames, previews, metadata, and potentially hostile recovered content. It must remain sandboxed. Electron only coordinates user actions and renders state.

The Rust daemon owns:

- Case state.
- Job state.
- Source identity.
- Acquisition.
- Hashing.
- Tool execution.
- Normalization.
- Validation.
- Export.
- Reports.

The privileged helper owns only operations that require elevation. It does not contain the UI or case logic.

## 12. Technology choices

### Desktop

- Electron 44 stable line.
- Node.js 24 LTS for build tooling.
- Electron Forge for packaging.
- React 19 and TypeScript.
- Vite.
- React Router.
- Radix UI primitives with an internal design system.
- Tailwind CSS for tokens and layout.
- TanStack Table and TanStack Virtual for very large result sets.
- Zustand for ephemeral UI state; server/job state comes from typed RPC subscriptions.
- Zod for renderer/main boundary validation.
- Storybook for components.
- Vitest and Playwright.

### Native backend

- Rust stable, pinned by `rust-toolchain.toml` when the repository is created.
- Tokio.
- Serde/serde_json.
- thiserror and anyhow at process boundaries only.
- tracing and tracing-subscriber.
- rusqlite with bundled SQLite and FTS5.
- sha2 for SHA-256.
- uuid with UUIDv7.
- nix on Unix and windows crate on Windows where needed.

### External tools

- The Sleuth Kit.
- TestDisk/PhotoRec.
- GNU ddrescue in Rescue Mode.
- libewf tools.
- YARA-X.
- Volatility 3.
- WinPmem/AVML/LiME in the memory acquisition phase.

Every binary is pinned in `tools/manifests/tools.lock.json` with version, platform, architecture, origin, license, and SHA-256.

## 13. Monorepo layout

```text
recovery-platform/
├── apps/
│   └── desktop/
│       ├── forge.config.ts
│       ├── package.json
│       ├── src/
│       │   ├── main/
│       │   │   ├── main.ts
│       │   │   ├── windows.ts
│       │   │   ├── security.ts
│       │   │   ├── daemon-supervisor.ts
│       │   │   └── ipc-handlers.ts
│       │   ├── preload/
│       │   │   ├── preload.ts
│       │   │   └── recovery-api.ts
│       │   └── renderer/
│       │       ├── app.tsx
│       │       ├── routes/
│       │       ├── features/
│       │       └── styles/
│       └── tests/
├── packages/
│   ├── contracts/
│   │   ├── src/domain.ts
│   │   ├── src/rpc.ts
│   │   ├── src/events.ts
│   │   └── schemas/
│   └── ui/
│       ├── src/components/
│       ├── src/tokens/
│       └── .storybook/
├── crates/
│   ├── recovery-domain/
│   ├── recovery-ipc/
│   ├── recovery-daemon/
│   ├── case-store/
│   ├── job-engine/
│   ├── source-inventory/
│   ├── safety-policy/
│   ├── image-io/
│   ├── acquisition/
│   ├── tool-runner/
│   ├── partition-scan/
│   ├── metadata-recovery/
│   ├── carving/
│   ├── validation/
│   ├── threat-scan/
│   ├── result-index/
│   ├── exporter/
│   ├── reporting/
│   ├── privileged-helper/
│   └── memory-analysis/
├── live/
│   ├── auto/config
│   ├── config/package-lists/
│   ├── config/includes.chroot/
│   ├── config/hooks/live/
│   └── scripts/build-live.sh
├── tools/
│   ├── manifests/tools.lock.json
│   ├── licenses/
│   └── rules/yara/
├── testdata/
│   ├── generated/
│   ├── expected/
│   └── scripts/
├── tests/
│   ├── integration/
│   ├── e2e/
│   ├── fault-injection/
│   └── platform/
└── docs/
```

## 14. Shared domain contracts

### 14.1 TypeScript contracts

```ts
export type RuntimeMode = 'installed' | 'rescue';

export type SourceKind =
  | 'physical_device'
  | 'raw_image'
  | 'ewf_image'
  | 'memory_image';

export type CapabilityLevel =
  | 'supported'
  | 'limited'
  | 'unsupported'
  | 'requires_rescue_mode'
  | 'requires_elevation'
  | 'requires_unlock';

export type RecoveryGoal =
  | 'recently_deleted'
  | 'specific_target'
  | 'recover_everything'
  | 'partition_loss'
  | 'damaged_device'
  | 'memory_analysis';

export type ScanPreset = 'quick' | 'full' | 'advanced';

export type JobStage =
  | 'draft'
  | 'preflight'
  | 'waiting_for_destination'
  | 'acquiring'
  | 'verifying_image'
  | 'partition_scan'
  | 'metadata_scan'
  | 'carving'
  | 'validating'
  | 'threat_scan'
  | 'indexing'
  | 'review_ready'
  | 'exporting'
  | 'reporting'
  | 'completed'
  | 'paused'
  | 'needs_attention'
  | 'cancelling'
  | 'cancelled'
  | 'failed';

export interface SourceDescriptor {
  sourceId: string;
  kind: SourceKind;
  displayName: string;
  stableId: string;
  sizeBytes: string;
  logicalSectorSize: number | null;
  physicalSectorSize: number | null;
  bus: string | null;
  model: string | null;
  serialRedacted: string | null;
  systemDisk: boolean;
  mountedReadWrite: boolean;
  encryptedState: 'none' | 'locked' | 'unlocked' | 'unknown';
  health: 'healthy' | 'warning' | 'failing' | 'unknown';
  capabilities: CapabilityFinding[];
}

export interface CapabilityFinding {
  code: string;
  level: CapabilityLevel;
  title: string;
  explanation: string;
  recommendedAction: string | null;
}

export interface RecoveryArtifact {
  artifactId: string;
  sourceId: string;
  partitionId: string | null;
  originalName: string | null;
  originalPath: string | null;
  displayName: string;
  extension: string | null;
  mimeType: string | null;
  sizeBytes: string;
  recoveryMethod: 'metadata' | 'carving' | 'allocated_export';
  recoveryState:
    | 'complete_validated'
    | 'complete_unverified'
    | 'partial_validated'
    | 'partial_unverified'
    | 'corrupt';
  sha256: string | null;
  sourceRanges: Array<{ offset: string; length: string }>;
  threatStatus: 'no_rule_match' | 'potential_threat' | 'scan_error' | 'not_scanned';
  previewStatus: 'safe_preview' | 'blocked' | 'unsupported';
}
```

Use strings for 64-bit byte counts at the JavaScript boundary to avoid precision loss.

### 14.2 Rust traits

```rust
#[async_trait::async_trait]
pub trait SourceReader: Send + Sync {
    fn descriptor(&self) -> &SourceDescriptor;
    async fn read_at(&self, offset: u64, buffer: &mut [u8]) -> Result<usize, SourceError>;
    async fn length(&self) -> Result<u64, SourceError>;
}

#[async_trait::async_trait]
pub trait ToolAdapter: Send + Sync {
    fn tool_id(&self) -> &'static str;
    fn capability(&self) -> ToolCapability;
    async fn execute(
        &self,
        context: ToolContext,
        request: ToolRequest,
        events: tokio::sync::mpsc::Sender<ToolEvent>,
        cancellation: tokio_util::sync::CancellationToken,
    ) -> Result<ToolOutcome, ToolError>;
}

#[async_trait::async_trait]
pub trait RecoveryEngine: Send + Sync {
    async fn scan_metadata(&self, request: MetadataScanRequest) -> Result<ScanSummary, RecoveryError>;
    async fn carve(&self, request: CarveRequest) -> Result<ScanSummary, RecoveryError>;
    async fn export(&self, request: ExportRequest) -> Result<ExportSummary, RecoveryError>;
}
```

## 15. RPC surface

Renderer-visible API exposed by preload:

```ts
export interface RecoveryDesktopApi {
  getRuntimeInfo(): Promise<RuntimeInfo>;
  createCase(input: CreateCaseInput): Promise<RecoveryCase>;
  openCase(casePath: string): Promise<RecoveryCase>;
  listSources(): Promise<SourceDescriptor[]>;
  addImageSource(input: AddImageSourceInput): Promise<SourceDescriptor>;
  assessSource(sourceId: string): Promise<SourceAssessment>;
  createRecoveryJob(input: CreateRecoveryJobInput): Promise<RecoveryJob>;
  startJob(jobId: string): Promise<void>;
  pauseJob(jobId: string): Promise<void>;
  resumeJob(jobId: string): Promise<void>;
  cancelJob(jobId: string): Promise<void>;
  queryArtifacts(query: ArtifactQuery): Promise<ArtifactPage>;
  getArtifact(artifactId: string): Promise<RecoveryArtifact>;
  requestPreview(artifactId: string): Promise<PreviewDescriptor>;
  exportArtifacts(input: ExportArtifactsInput): Promise<ExportJob>;
  generateReport(caseId: string): Promise<ReportDescriptor>;
  subscribeJobEvents(listener: (event: JobEvent) => void): () => void;
}
```

The renderer may not receive generic methods such as `runCommand`, `readFile`, `writeFile`, or `openPath`.

## 16. Job engine and persistence

State transitions:

```text
DRAFT
  → PREFLIGHT
  → WAITING_FOR_DESTINATION (when acquisition is needed)
  → ACQUIRING
  → VERIFYING_IMAGE
  → PARTITION_SCAN
  → METADATA_SCAN
  → CARVING (when requested)
  → VALIDATING
  → THREAT_SCAN
  → INDEXING
  → REVIEW_READY
  → EXPORTING (optional, repeatable)
  → REPORTING
  → COMPLETED
```

Any running state may enter:

- `PAUSED` if the underlying adapter supports a safe pause.
- `NEEDS_ATTENTION` for a disconnected source/destination or missing unlock material.
- `CANCELLING` then `CANCELLED`.
- `FAILED` only after an unrecoverable error.

Persist every state transition and checkpoint. A restart must not rerun completed phases unless the user explicitly creates a new job.

Cancellation semantics:

- Metadata scan: stop after current record batch.
- Carving: terminate child process gracefully, preserve recovered artifacts and raw logs, mark partial.
- Raw acquisition: flush destination and checkpoint; never call cancellation “completed.”
- ddrescue: send interrupt, preserve mapfile, allow resume.

## 17. Case storage

```text
<case-root>/
├── case.json
├── case.sqlite
├── audit/
│   └── events.ndjson
├── sources/
│   └── <source-id>.json
├── images/
│   └── references.json
├── maps/
├── work/
│   └── <job-id>/
├── recovered/
│   └── quarantine/
├── previews/
├── exports/
├── logs/
│   └── tools/
└── reports/
```

Rules:

- `case.sqlite` uses WAL with `synchronous=FULL`.
- On clean shutdown, checkpoint the WAL.
- `events.ndjson` is append-only and mirrors critical state changes.
- Store no passwords, recovery keys, or full memory secrets in logs.
- Large image files may remain external; store canonical references and hashes.
- Use atomic rename for new manifests and reports.

## 18. Source safety policy

Hard blocks:

- Physical source and export destination are the same device.
- Physical source and acquisition destination are the same device.
- Destination lacks required free space plus safety reserve.
- Stable source identity no longer matches.
- The selected image segment set is incomplete and strict mode is enabled.
- The source must be opened read-write for the requested operation.
- A user requests in-place repair or partition-table write.

Warnings requiring acknowledgement:

- Active system disk in Installed Mode.
- SSD with likely TRIM impact.
- USB bridge with uncertain error reporting.
- Source health warning.
- Network destination.
- Experimental filesystem support.
- Recovery without a full image.

## 19. Tool runner security

- No shell invocation.
- Executable path comes only from the signed/pinned tool manifest.
- Arguments are arrays produced by adapters.
- Working directory is unique per job.
- Environment is allowlisted.
- Network is disabled for tool workers unless a future authorized function explicitly requires it.
- Stdout/stderr size is bounded and streamed to disk.
- Timeouts and cancellation are mandatory.
- Raw output is retained.
- Exit code alone does not define success; adapters validate expected outputs.
- Recovered archives are never recursively extracted without size, depth, path, and file-count limits.

## 20. Preview security

Supported safe previews:

- Raster images decoded to a new sanitized bitmap.
- Plain text with a byte/line limit and encoding detection.
- PDF rendered to images in a sandboxed worker, not embedded with active scripting.
- Office documents shown as metadata/thumbnail only in MVP.
- Audio/video metadata and optional sanitized playback later.

Blocked by default:

- Executables, scripts, DLLs, shell files, macros, HTML with scripts, unknown binaries.
- Password-protected archives.
- Files flagged by YARA-X.

The UI never launches a recovered file with the system default application from the results screen.

## 21. Result quality rules

### Metadata result

Display:

- “Original name available” only when obtained from a surviving filesystem record.
- Original path and timestamp with a provenance label.
- Data completeness based on readable extents and validation.

### Carved result

Display:

- A generated display name such as `JPEG_000184.jpg`.
- Label: “Recovered by content signature.”
- Label: “Original name and folder unavailable.”
- Source byte ranges.
- Validator findings.

### Duplicates

Group by SHA-256 after complete hashing. Do not discard duplicates automatically; two identical files at different original paths may be evidentially distinct.

## 22. UI principles

- Professional evidence console, not a neon “hacker” interface.
- Plain-language default with an Advanced Details drawer.
- Case-first workflow.
- Persistent source and destination identity.
- One primary action per screen.
- Destructive-looking red is reserved for safety blocks and potential threats.
- Progress is shown as named stages, bytes processed, throughput, and an ETA range.
- Never hide a long-running operation behind an indeterminate spinner when measurable bytes exist.
- Status is communicated through text and icon, not color alone.
- Full keyboard support, visible focus, screen-reader status announcements, and scalable text.

The results workspace follows a proven forensic pattern:

```text
┌──────────────┬────────────────────────────────┬──────────────────┐
│ Filters/tree │ Result table or thumbnail grid │ Preview/details  │
│              │                                │                  │
└──────────────┴────────────────────────────────┴──────────────────┘
```

## 23. Exact user-facing terminology

Use:

- Recovery, not retrieval, in most UI labels.
- Source device.
- Destination drive.
- Rescue Mode.
- File record.
- Content-signature recovery.
- Original name unavailable.
- Complete, Partial, Corrupt, Unverified.
- Potentially unsafe.

Avoid as default copy:

- inode, MFT, LBA, block map, extents, DFXML, SANICAP, raw offset.

These may appear under Advanced Details with an info explanation.

## 24. Edge-case behavior matrix

| Condition | Detection | Required behavior |
|---|---|---|
| Active system disk | OS/device topology | Block deep recovery by default; offer Rescue Mode |
| Same source/destination device | Stable physical IDs | Hard block |
| Source disconnected | Read failure + inventory event | Enter `NEEDS_ATTENTION`; preserve checkpoint; revalidate on reconnect |
| Different device connected at same path | Stable ID mismatch | Refuse resume |
| Destination full | Free-space monitor | Pause safely; request new destination |
| Destination disconnected | Write error + inventory event | Pause; do not retry to a different path silently |
| Bad sectors | Read error ranges | Prefer ddrescue; record unreadable ranges; mark affected artifacts partial |
| SSD/TRIM | media/filesystem indicators | Explain reduced chance; do not promise recovery |
| Missing partition table | parser failure | Run read-only partition candidate scan; never write source |
| GPT/MBR inconsistency | parser findings | Show candidate layouts and confidence |
| 4Kn/512e mismatch | geometry | Use source sector sizes; include in report |
| Split image missing segment | sequence validation | Block strict analysis or allow limited mode with explicit gaps |
| Corrupt E01 | libewf verification | Mark incomplete; preserve verifier output |
| Encrypted locked source | metadata indicators | Request authorized unlock material outside logs; otherwise stop |
| Unsupported filesystem | capability map | Offer raw carving only |
| NTFS sparse/compressed file | metadata flags | Recover through TSK; validate output and mark limits |
| NTFS alternate data streams | metadata enumeration | Show as child streams and export safely |
| Hard links | shared metadata/file ID | Preserve relationship; do not double-count unique content silently |
| Filename path traversal | normalized export path | Replace unsafe components; never escape export root |
| Windows reserved name | export sanitizer | Rename deterministically and record mapping |
| Huge result set | count threshold | Paginate/virtualize; query server-side |
| Carving false positive | validator | Mark corrupt/unverified; hide from default “likely usable” filter |
| Partially overwritten file | validator/extents | Mark partial; show readable percentage only when measurable |
| Malicious recovered file | YARA-X/rule match | Block preview; require explicit controlled export acknowledgement |
| Archive bomb | archive probe limits | Stop validation; mark potentially unsafe |
| App crash | persisted checkpoints | Resume completed stages |
| Power loss during acquisition | destination + checkpoint | Verify completed chunks; resume or restart safely |
| Tool crash | exit/event monitor | Preserve log; retry only when policy permits; show typed failure |
| Tool version mismatch | manifest verification | Refuse execution |
| Network destination latency | throughput/timeout | Warn, checkpoint frequently, support pause |
| RAID/LVM detected | signatures/topology | Do not auto-assemble in MVP; route to Advanced/Rescue and explain |
| APFS/T2/Fusion limitations | capability probe | Image/raw carve or unsupported; no false path recovery claim |
| ReFS v2/v3 | capability probe | Raw carve only unless verified parser added |
| Memory symbols missing | Volatility outcome | Show actionable symbol/profile limitation |
| Linux kernel lockdown | AVML error | Explain that acquisition is blocked; suggest authorized Rescue/alternate method |
| Insufficient privileges | helper response | Show elevation action; do not expose raw error only |
| User tries to install on source after deletion | source/system context | Show warning that installation can overwrite recoverable data |

## 25. Performance requirements

- UI remains responsive during all jobs.
- Job progress events are throttled to at most 10 UI updates per second.
- Result table supports at least one million indexed artifacts through server-side pagination and virtualization.
- Metadata results begin appearing incrementally; user need not wait for full carving.
- Hashing and acquisition use bounded buffers and backpressure.
- Carving workers do not exceed configured CPU and I/O concurrency.
- Default concurrency is conservative on failing media.
- Preview generation is lazy.
- Search queries under typical indexed conditions should return the first page in under one second on the reference workstation.

## 26. Accessibility and language readiness

- Meet WCAG 2.2 AA behavior applicable to the Electron UI.
- Visible keyboard focus.
- No keyboard traps.
- Status messages announced through `role=status` or equivalent.
- Minimum target sizes and adequate contrast.
- Do not use color as the only indicator.
- System font stack with Noto Sans fallback where installed.
- All strings come from localization files.
- English first; architecture must allow Hindi and other Indian-language localization without layout breakage.

## 27. Packaging and deployment

### Windows

- Signed installer.
- Bundled daemon and verified tools.
- Optional privileged service installed explicitly.
- No auto-update in air-gapped build.

### BOSS/Debian/Ubuntu

- `.deb` is mandatory for BOSS 10.
- AppImage optional for broader Linux testing.
- Polkit policy for raw-device helper.
- Desktop entry and MIME associations for supported image files.

### macOS

- Universal or separate x64/arm64 DMG.
- Code signing and notarization for production.
- Privileged helper only if required; image analysis works without it.

### Rescue ISO

- Built using Debian live-build.
- Includes firmware required for common storage controllers where licensing permits.
- Includes app `.deb`, backend, pinned tools, udev/polkit policy, no-automount rules, and startup launcher.
- Build produces ISO SHA-256 and manifest.

## 28. Test data

Create deterministic synthetic images rather than relying only on real user media.

Required fixtures:

1. FAT32 image with allocated and deleted JPEG/PDF files.
2. exFAT image with deleted files and long names.
3. NTFS image with deleted folder tree, sparse file, compressed file, alternate data stream, hard link, and fragmented file.
4. ext4 image with deleted files and journal activity.
5. Raw image with damaged/missing partition table but intact filesystem signature.
6. Image with random data and planted file signatures for false-positive testing.
7. Split raw image with one missing segment.
8. Corrupt E01 fixture where legally distributable.
9. Memory-image fixture with a known process and YARA test pattern.
10. Malicious-looking but harmless EICAR-style/test-rule artifact for quarantine behavior.

Use NIST CFReDS and other documented public forensic datasets as additional validation, not as the only tests.

## 29. Acceptance criteria

### Vertical-slice acceptance

- Open a raw image without elevation.
- Create and reopen a case.
- Detect partitions.
- Recover a deleted NTFS file with original path through metadata.
- Carve a JPEG whose metadata is absent.
- Validate both results.
- Index and filter them.
- Preview the safe image.
- Export to a selected destination.
- Generate a report.
- Confirm source image SHA-256 is unchanged.
- Resume after forced application termination.

### Installed-platform acceptance

- Windows installer launches and analyzes image fixtures.
- BOSS 10 `.deb` installs and analyzes image fixtures.
- macOS build opens image fixtures and exports results.
- Renderer security tests confirm no Node integration and no raw IPC exposure.

### Rescue-mode acceptance

- ISO boots in a VM in UEFI mode.
- Storage is not auto-mounted.
- Same Electron application auto-launches.
- A physical test disk can be acquired read-only to a separate destination.
- Current system disk warning differs appropriately from Installed Mode.
- ddrescue job can be interrupted and resumed from its mapfile.

### Recovery-quality acceptance

- Expected fixture files are recovered with exact hashes where intact.
- Partial files are never labelled complete.
- Carved files never receive fabricated original names.
- Unsupported filesystems show raw-carve-only or unsupported states.
- YARA-X test rule blocks preview.
- Export path traversal tests cannot escape the destination.

## 30. Explicit non-goals for the current workstream

- Secure deletion or wiping.
- Partition repair on the source.
- In-place undelete.
- Password cracking.
- Cloud API access.
- Automatic malware execution/dynamic analysis.
- Full mobile-device extraction.
- Apple Silicon live boot.
- Full APFS/ReFS deleted-metadata recovery.
- Automatic RAID reconstruction for arbitrary arrays.
- AI fragment reconstruction in the MVP.
- Blockchain.
- Production PKI certificate infrastructure.

## 31. Research decisions Codex should respect

- Electron’s renderer must be sandboxed, context-isolated, and exposed only to a narrow preload API.
- BOSS GNU/Linux 10 is Debian 12-derived, so the primary Linux package is a Debian `.deb` and all tests include BOSS 10.
- The Sleuth Kit is the metadata-first foundation; its own guidance recommends independent verification of forensic results.
- PhotoRec is the fallback carver and may recover payloads without original names or paths.
- ddrescue is used for unstable devices because its mapfile and healthy-regions-first strategy support safe resumption.
- YARA-X classifies recovered content; it is not a recovery mechanism.
- Volatility 3 analyzes memory images but does not acquire memory itself.
- APFS and ReFS support must be conservative because available open-source parsers have important version and feature limitations.
- The UI borrows the case-first and three-pane review pattern used by mature forensic applications, while replacing examiner jargon with guided copy.

