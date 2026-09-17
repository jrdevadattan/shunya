# Recovery Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the recovery-only SIH 26149 module as a secure Electron desktop application plus a bootable Rescue Mode, supporting specific file/folder recovery, whole-source imaging and recovery, damaged-media handling, memory-image analysis, safe review, and verified export without modifying the source.

**Architecture:** Electron/React is the sandboxed presentation and orchestration layer. A Rust daemon owns the case model, jobs, hashing, forensic-tool adapters, indexing, export, and reports; a minimal privileged helper handles read-only physical-device access. The installed application and Debian-based Rescue Mode ship the same UI, daemon, contracts, case format, and test corpus.

**Tech Stack:** Electron 44, Node.js 24 LTS, Electron Forge, React 19, TypeScript, Vite, Radix UI, Tailwind CSS, TanStack Table/Virtual, Zod, Rust stable, Tokio, Serde, SQLite/FTS5, The Sleuth Kit, TestDisk/PhotoRec, GNU ddrescue, libewf, YARA-X, Volatility 3, Vitest, Playwright, Storybook, cargo-nextest.

**Spec:** `docs/specs/recovery-module.md`

## Global Constraints

- Recovery only. Do not implement secure deletion, wiping, partition repair, in-place undelete, cloud deletion, or sanitization commands.
- The source is always opened read-only. Any operation requiring a source write returns `UNSUPPORTED`.
- Installed Mode and Rescue Mode use the same source tree, UI routes, Rust core, contracts, case format, and report format.
- BOSS GNU/Linux 10 x86-64 is a mandatory platform target and receives a `.deb` package.
- Rescue Mode MVP supports x86-64 UEFI and legacy BIOS; Apple Silicon rescue boot is outside scope.
- Electron renderer: `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, restrictive CSP, no remote code, no generic IPC exposure.
- Renderer never executes tools, reads arbitrary files, or opens recovered active content.
- Every external tool is pinned by version and SHA-256 in `tools/manifests/tools.lock.json` and invoked without a shell.
- Every job is resumable at stage boundaries and preserves completed work after application termination.
- Metadata-derived names/paths and carved content are represented differently; carved artifacts never receive fabricated original names.
- Recovered files are quarantined, validated, and YARA-X classified before preview/export.
- Export to the source physical device is a hard block.
- Large byte counts cross the JavaScript boundary as decimal strings.
- Tests are written before implementation. Each task ends with independently testable software and a commit.

---

## 1. Locked architecture and file map

Create or modify only the following responsibility-focused areas. Do not merge the daemon, helper, tool adapters, and UI into a monolithic process.

```text
apps/desktop/                       Electron shell and renderer
packages/contracts/                 Shared TypeScript contracts and JSON schemas
packages/ui/                        Reusable UI components and tokens
crates/recovery-domain/             Pure Rust domain types and state rules
crates/recovery-ipc/                NDJSON RPC protocol and transport
crates/recovery-daemon/             Daemon composition root
crates/case-store/                  SQLite, migrations, case paths, audit log
crates/job-engine/                  Persistent job state machine
crates/source-inventory/            Cross-platform source discovery
crates/safety-policy/               Source/destination capability decisions
crates/image-io/                    Raw, split raw, EWF SourceReader implementations
crates/acquisition/                 Healthy-source imaging and hashing
crates/tool-runner/                 Sandboxed process execution and manifests
crates/partition-scan/              TSK/TestDisk partition normalization
crates/metadata-recovery/           TSK deleted-record recovery adapter
crates/carving/                     PhotoRec adapter and output normalization
crates/validation/                  File validators and completeness model
crates/threat-scan/                 YARA-X adapter and quarantine policy
crates/result-index/                Artifact index, FTS5, pagination, saved filters
crates/exporter/                    Safe paths, collision handling, verified export
crates/reporting/                   JSON/Markdown report and manifest
crates/privileged-helper/           Read-only raw-device operations
crates/memory-analysis/             Volatility and memory-acquisition adapters
live/                               Debian live-build configuration
tools/manifests/                    Tool versions, hashes, licenses
 testdata/                          Deterministic forensic fixtures
 tests/                             Cross-crate, E2E, platform, and fault tests
```

## 2. Delivery order

Codex must deliver the system in this order:

1. Image-file vertical slice.
2. Metadata recovery.
3. Carving and result review.
4. Safe export and report.
5. Physical-device inventory/acquisition.
6. Rescue Mode.
7. Damaged-media workflow.
8. Memory-image analysis.
9. Cross-platform packaging and hardening.

Do not begin Rescue Mode or raw physical-device work before the raw-image vertical slice passes acceptance tests.

---

### Task 1: Bootstrap the pnpm/Cargo monorepo and local validation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.nvmrc`
- Create: `Cargo.toml`
- Create: `rust-toolchain.toml`
- Create: `.editorconfig`
- Create: `.gitignore`
- Create: `apps/desktop/package.json`
- Create: `packages/contracts/package.json`
- Create: `packages/ui/package.json`
- Create: `crates/recovery-domain/Cargo.toml`
- Test: `tests/repository/test_workspace.sh`

**Interfaces:**
- Produces: pnpm workspace commands `lint`, `typecheck`, `test`, `test:e2e`, `build`.
- Produces: Cargo workspace command `cargo nextest run --workspace`.
- Produces: pinned Node 24 LTS through `.nvmrc` and a pinned current stable Rust toolchain written at implementation time.

- [ ] **Step 1: Write the workspace smoke test**

```bash
#!/usr/bin/env bash
set -euo pipefail

test -f package.json
test -f pnpm-workspace.yaml
test -f Cargo.toml
test -f rust-toolchain.toml
pnpm --version
cargo metadata --no-deps --format-version 1 >/dev/null
pnpm -r exec node -e "process.exit(0)"
```

- [ ] **Step 2: Run the smoke test and verify it fails**

Run: `bash tests/repository/test_workspace.sh`

Expected: FAIL because workspace files do not exist.

- [ ] **Step 3: Scaffold the workspace**

Root `package.json`:

```json
{
  "name": "sih-recovery-platform",
  "private": true,
  "packageManager": "pnpm@10.15.0",
  "engines": { "node": ">=24 <25" },
  "scripts": {
    "lint": "pnpm -r lint && cargo clippy --workspace --all-targets -- -D warnings",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test && cargo nextest run --workspace",
    "test:e2e": "pnpm --filter @recovery/desktop test:e2e",
    "build": "pnpm -r build && cargo build --workspace --release"
  }
}
```

Root `Cargo.toml`:

```toml
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.package]
edition = "2024"
license = "Apache-2.0"

[workspace.dependencies]
anyhow = "1"
async-trait = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "2"
tokio = { version = "1", features = ["full"] }
tokio-util = "0.7"
tracing = "0.1"
uuid = { version = "1", features = ["v7", "serde"] }
```

Use `rustup show active-toolchain` to capture the exact stable toolchain, then write it to `rust-toolchain.toml` with `components = ["clippy", "rustfmt"]`.

- [ ] **Step 4: Add native-host validation for Ubuntu, Windows, and macOS**

Release operators run formatting, TypeScript typechecking, unit tests, Rust clippy, Rust tests, and desktop packaging smoke builds on the native build hosts. BOSS-specific VM tests are added later.

- [ ] **Step 5: Run all bootstrap checks**

Run:

```bash
bash tests/repository/test_workspace.sh
pnpm install --frozen-lockfile=false
pnpm lint
pnpm typecheck
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo nextest run --workspace
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "build: bootstrap recovery platform monorepo"
```

---

### Task 2: Define shared domain contracts and JSON schemas

**Files:**
- Create: `packages/contracts/src/domain.ts`
- Create: `packages/contracts/src/rpc.ts`
- Create: `packages/contracts/src/events.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/schemas/rpc-envelope.schema.json`
- Create: `packages/contracts/tests/domain.test.ts`
- Create: `crates/recovery-domain/src/lib.rs`
- Create: `crates/recovery-domain/src/source.rs`
- Create: `crates/recovery-domain/src/job.rs`
- Create: `crates/recovery-domain/src/artifact.rs`
- Create: `crates/recovery-domain/tests/serde_contracts.rs`

**Interfaces:**
- Produces TypeScript types `SourceDescriptor`, `RecoveryCase`, `RecoveryJob`, `RecoveryArtifact`, `JobEvent`.
- Produces Rust equivalents with identical snake/camel JSON serialization.
- Produces `RpcRequest`, `RpcResponse`, and `RpcEvent` envelopes.

- [ ] **Step 1: Write cross-language fixture tests**

TypeScript:

```ts
import { describe, expect, it } from 'vitest';
import { SourceDescriptorSchema } from '../src/domain';
import fixture from './fixtures/source-descriptor.json';

describe('SourceDescriptor', () => {
  it('accepts the canonical fixture without numeric precision loss', () => {
    const parsed = SourceDescriptorSchema.parse(fixture);
    expect(parsed.sizeBytes).toBe('4000787030016');
  });
});
```

Rust:

```rust
#[test]
fn source_descriptor_matches_canonical_fixture() {
    let raw = include_str!("../../packages/contracts/tests/fixtures/source-descriptor.json");
    let source: recovery_domain::SourceDescriptor = serde_json::from_str(raw).unwrap();
    assert_eq!(source.size_bytes, 4_000_787_030_016);
}
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @recovery/contracts test
cargo nextest run -p recovery-domain
```

Expected: FAIL because schemas/types do not exist.

- [ ] **Step 3: Implement canonical types**

Implement the types from the product specification. Serialize `u64` byte counts as decimal strings through custom Serde helpers. Define capability and job-state enums exactly once in each language.

Required Rust state transition function:

```rust
pub fn can_transition(from: JobStage, to: JobStage) -> bool;
```

- [ ] **Step 4: Add invalid-transition tests**

```rust
#[test]
fn completed_job_cannot_return_to_carving() {
    assert!(!can_transition(JobStage::Completed, JobStage::Carving));
}
```

- [ ] **Step 5: Run tests and schema validation**

Run:

```bash
pnpm --filter @recovery/contracts test
cargo nextest run -p recovery-domain
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts crates/recovery-domain
git commit -m "feat: define recovery domain contracts"
```

---

### Task 3: Build the secure Electron shell and narrow preload API

**Files:**
- Create: `apps/desktop/forge.config.ts`
- Create: `apps/desktop/src/main/main.ts`
- Create: `apps/desktop/src/main/windows.ts`
- Create: `apps/desktop/src/main/security.ts`
- Create: `apps/desktop/src/main/ipc-handlers.ts`
- Create: `apps/desktop/src/preload/preload.ts`
- Create: `apps/desktop/src/preload/recovery-api.ts`
- Create: `apps/desktop/src/renderer/index.html`
- Create: `apps/desktop/src/renderer/app.tsx`
- Test: `apps/desktop/tests/security/window-security.test.ts`
- Test: `apps/desktop/tests/security/preload-surface.test.ts`

**Interfaces:**
- Produces `window.recoveryApi` containing only methods declared in `RecoveryDesktopApi`.
- Consumes contract schemas from `@recovery/contracts`.
- Produces custom protocol `recovery://app` for local packaged content.

- [ ] **Step 1: Write failing BrowserWindow security tests**

```ts
it('creates a sandboxed and context-isolated renderer', () => {
  const options = buildMainWindowOptions();
  expect(options.webPreferences.nodeIntegration).toBe(false);
  expect(options.webPreferences.contextIsolation).toBe(true);
  expect(options.webPreferences.sandbox).toBe(true);
  expect(options.webPreferences.webSecurity).toBe(true);
});
```

- [ ] **Step 2: Write failing preload-surface test**

```ts
it('does not expose generic IPC or filesystem methods', () => {
  expect(Object.keys(exposedApi)).not.toContain('send');
  expect(Object.keys(exposedApi)).not.toContain('readFile');
  expect(Object.keys(exposedApi)).not.toContain('runCommand');
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm --filter @recovery/desktop test -- security`

Expected: FAIL.

- [ ] **Step 4: Implement the secure shell**

Apply:

- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- deny navigation outside `recovery://app`
- deny new windows
- permission request handler returns false by default
- strict CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'`
- validate every IPC sender frame URL
- disable unsafe Electron fuses in packaging

The preload wraps every request with Zod validation and strips the Electron event object from subscriptions.

- [ ] **Step 5: Add E2E assertion that Node globals are absent**

```ts
await expect(page.evaluate(() => typeof (window as any).require)).resolves.toBe('undefined');
await expect(page.evaluate(() => typeof (window as any).process)).resolves.toBe('undefined');
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @recovery/desktop test
pnpm --filter @recovery/desktop test:e2e -- --grep "security shell"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop
git commit -m "feat: add secure Electron application shell"
```

---

### Task 4: Build the design system, application shell, and route skeleton

**Files:**
- Create: `packages/ui/src/tokens/colors.css`
- Create: `packages/ui/src/tokens/spacing.css`
- Create: `packages/ui/src/components/AppShell.tsx`
- Create: `packages/ui/src/components/RuntimeModeBadge.tsx`
- Create: `packages/ui/src/components/InfoPopover.tsx`
- Create: `packages/ui/src/components/CapabilityBanner.tsx`
- Create: `packages/ui/src/components/StageTimeline.tsx`
- Create: `packages/ui/src/components/ResultStatusBadge.tsx`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/components/*.stories.tsx`
- Create: `apps/desktop/src/renderer/routes/router.tsx`
- Create: `apps/desktop/src/renderer/routes/WelcomePage.tsx`
- Create: `apps/desktop/src/renderer/routes/NewCasePage.tsx`
- Create: `apps/desktop/src/renderer/routes/CaseLayout.tsx`
- Test: `packages/ui/tests/accessibility.test.tsx`
- Test: `apps/desktop/tests/e2e/navigation.spec.ts`

**Interfaces:**
- Produces reusable UI components from the UX spec.
- Produces route IDs used by later tasks.
- Consumes `RuntimeMode` and status enums from contracts.

- [ ] **Step 1: Write accessibility tests for focus and status text**

```tsx
it('renders warning status with icon, text, and accessible name', async () => {
  const { container, getByText } = render(
    <CapabilityBanner level="warning" title="Rescue Mode recommended" explanation="The disk is in use." />
  );
  expect(getByText('Rescue Mode recommended')).toBeVisible();
  expect(await axe(container)).toHaveNoViolations();
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @recovery/ui test`

Expected: FAIL.

- [ ] **Step 3: Implement tokens and components**

Use semantic colors, system font stack, visible 2 px focus ring, status text plus icon, dark/light themes, reduced-motion media query, and localization keys instead of inline permanent strings.

- [ ] **Step 4: Implement welcome and case shell routes**

Welcome page must render the four start cards and runtime-mode explanation from the UX spec. Case shell must render left navigation and case header but can use fixture state until Task 7.

- [ ] **Step 5: Add Storybook states**

Create stories for Installed/Rescue badges, success/warning/danger banners, running/paused timelines, light/dark mode, and 200% text zoom.

- [ ] **Step 6: Run component and E2E tests**

Run:

```bash
pnpm --filter @recovery/ui test
pnpm --filter @recovery/desktop test:e2e -- --grep "navigation"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ui apps/desktop/src/renderer
git commit -m "feat: add recovery UI shell and design system"
```

---

### Task 5: Implement the Rust daemon and typed NDJSON RPC transport

**Files:**
- Create: `crates/recovery-ipc/Cargo.toml`
- Create: `crates/recovery-ipc/src/lib.rs`
- Create: `crates/recovery-ipc/src/envelope.rs`
- Create: `crates/recovery-ipc/src/server.rs`
- Create: `crates/recovery-ipc/src/client_test.rs`
- Create: `crates/recovery-daemon/Cargo.toml`
- Create: `crates/recovery-daemon/src/main.rs`
- Create: `crates/recovery-daemon/src/router.rs`
- Create: `apps/desktop/src/main/daemon-supervisor.ts`
- Test: `crates/recovery-ipc/tests/rpc_roundtrip.rs`
- Test: `apps/desktop/tests/integration/daemon-supervisor.test.ts`

**Interfaces:**
- Produces daemon commands `runtime.get`, `case.create`, `case.open`, `source.list`, `source.add_image`, `source.assess`, `job.create`, `job.start`, `job.pause`, `job.resume`, `job.cancel`, `artifact.query`, `artifact.get`, `artifact.preview`, `export.start`, `report.generate`.
- Produces event stream `job.event`, `source.event`, `daemon.health`.
- Electron main supervises the signed bundled `recoveryd` binary through stdin/stdout without a shell.

- [ ] **Step 1: Write RPC framing test**

```rust
#[tokio::test]
async fn parses_two_newline_delimited_requests_without_cross_talk() {
    let input = br#"{"id":"1","method":"runtime.get","params":{}}\n{"id":"2","method":"runtime.get","params":{}}\n"#;
    let requests = decode_frames(&input[..]).await.unwrap();
    assert_eq!(requests.len(), 2);
}
```

- [ ] **Step 2: Write daemon-crash recovery test**

The Electron supervisor test starts a fixture daemon, kills it, verifies one automatic restart, and then surfaces a typed `DAEMON_UNAVAILABLE` error if repeated crashes exceed policy.

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cargo nextest run -p recovery-ipc
pnpm --filter @recovery/desktop test -- daemon-supervisor
```

Expected: FAIL.

- [ ] **Step 4: Implement NDJSON envelopes**

```rust
#[derive(Serialize, Deserialize)]
pub struct RpcRequest {
    pub id: uuid::Uuid,
    pub method: String,
    pub params: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RpcFrame {
    Response { id: uuid::Uuid, result: serde_json::Value },
    Error { id: uuid::Uuid, error: RpcErrorBody },
    Event { topic: String, payload: serde_json::Value },
}
```

Limit each frame to 8 MiB and reject malformed UTF-8 or unknown methods.

- [ ] **Step 5: Implement daemon supervision**

Use `spawn(executable, [], { shell: false, stdio: ['pipe', 'pipe', 'pipe'] })`. Verify the executable hash against the packaged manifest before launch. Pass case secrets through inherited pipes, never command-line arguments.

- [ ] **Step 6: Run roundtrip tests**

Run:

```bash
cargo nextest run -p recovery-ipc -p recovery-daemon
pnpm --filter @recovery/desktop test -- daemon-supervisor
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/recovery-ipc crates/recovery-daemon apps/desktop/src/main
git commit -m "feat: add typed recovery daemon RPC"
```

---

### Task 6: Implement case storage, migrations, and append-only activity log

**Files:**
- Create: `crates/case-store/Cargo.toml`
- Create: `crates/case-store/src/lib.rs`
- Create: `crates/case-store/src/paths.rs`
- Create: `crates/case-store/src/database.rs`
- Create: `crates/case-store/src/audit.rs`
- Create: `crates/case-store/migrations/0001_initial.sql`
- Create: `crates/case-store/tests/case_lifecycle.rs`
- Create: `apps/desktop/src/renderer/features/cases/NewCaseForm.tsx`
- Create: `apps/desktop/src/renderer/features/cases/case-store.ts`
- Test: `apps/desktop/tests/e2e/case-lifecycle.spec.ts`

**Interfaces:**
- Produces `CaseStore::create`, `CaseStore::open`, `CaseStore::append_event`, `CaseStore::checkpoint`.
- Produces tables: `cases`, `sources`, `jobs`, `job_checkpoints`, `partitions`, `artifacts`, `artifact_ranges`, `exports`, `audit_events`.
- Produces case directory structure from the spec.

- [ ] **Step 1: Write atomic case-creation test**

```rust
#[test]
fn failed_creation_does_not_leave_a_half_case() {
    let root = tempdir().unwrap();
    let result = CaseStore::create_with_injected_failure(root.path(), FailurePoint::AfterDatabase);
    assert!(result.is_err());
    assert!(!root.path().join("case.json").exists());
}
```

- [ ] **Step 2: Write reopen-and-audit test**

Create a case, append an event, close, reopen, and assert that both SQLite and `audit/events.ndjson` contain the same event ID.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p case-store`

Expected: FAIL.

- [ ] **Step 4: Implement schema and case directories**

Use UUIDv7 IDs, UTC timestamps, `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=FULL`, foreign keys, and atomic manifest writes through temporary file plus rename.

- [ ] **Step 5: Wire New Case UI to daemon**

Validate title, operator, workspace writability, and free space. A non-empty folder cannot be silently overwritten.

- [ ] **Step 6: Run backend and E2E tests**

Run:

```bash
cargo nextest run -p case-store
pnpm --filter @recovery/desktop test:e2e -- --grep "case lifecycle"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/case-store apps/desktop/src/renderer/features/cases
git commit -m "feat: add persistent recovery cases"
```


---

### Task 7: Implement the persistent job engine and recovery-stage orchestration

**Files:**
- Create: `crates/job-engine/Cargo.toml`
- Create: `crates/job-engine/src/lib.rs`
- Create: `crates/job-engine/src/state_machine.rs`
- Create: `crates/job-engine/src/checkpoint.rs`
- Create: `crates/job-engine/src/executor.rs`
- Create: `crates/job-engine/tests/state_transitions.rs`
- Create: `crates/job-engine/tests/restart_resume.rs`
- Modify: `crates/recovery-daemon/src/router.rs`
- Create: `apps/desktop/src/renderer/features/jobs/job-store.ts`
- Create: `apps/desktop/src/renderer/features/jobs/JobProgressPage.tsx`
- Test: `apps/desktop/tests/e2e/job-resume.spec.ts`

**Interfaces:**
- Produces `JobEngine::create_job`, `start`, `pause`, `resume`, `cancel`, `recover_incomplete_jobs`.
- Emits `JobEvent` with monotonic sequence numbers.
- Consumes stage handlers registered as `JobStageHandler` implementations.

- [ ] **Step 1: Write transition-table tests**

```rust
#[test]
fn only_declared_transitions_are_allowed() {
    assert!(can_transition(JobStage::Preflight, JobStage::PartitionScan));
    assert!(can_transition(JobStage::Carving, JobStage::Validating));
    assert!(!can_transition(JobStage::Completed, JobStage::MetadataScan));
    assert!(!can_transition(JobStage::Cancelled, JobStage::Exporting));
}
```

- [ ] **Step 2: Write restart-resume test**

Create a job, mark `partition_scan` complete, simulate daemon termination during `metadata_scan`, reopen the case, and assert that `partition_scan` is not rerun and the job returns as `paused_recoverable` until the user selects Resume.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p job-engine`

Expected: FAIL.

- [ ] **Step 4: Implement state machine and checkpoints**

Each checkpoint stores:

```rust
pub struct StageCheckpoint {
    pub job_id: JobId,
    pub stage: JobStage,
    pub status: CheckpointStatus,
    pub progress_units: u64,
    pub continuation: serde_json::Value,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}
```

A stage must mark `started`, periodically update continuation data, then atomically mark `completed` with its output summary.

- [ ] **Step 5: Implement event replay**

When a renderer subscribes after restart, send the current job snapshot followed by new events. Ignore duplicated event sequence numbers in the UI store.

- [ ] **Step 6: Build progress UI**

Render user-facing stages from the UX spec, bytes, throughput, ETA range, files found, errors, Pause/Resume/Cancel, and a technical log drawer. Route changes must not stop the job.

- [ ] **Step 7: Run restart E2E test**

Run:

```bash
cargo nextest run -p job-engine
pnpm --filter @recovery/desktop test:e2e -- --grep "resume after restart"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add crates/job-engine crates/recovery-daemon apps/desktop/src/renderer/features/jobs
git commit -m "feat: add resumable recovery job engine"
```

---

### Task 8: Implement image-file source selection and cross-platform source inventory

**Files:**
- Create: `crates/source-inventory/Cargo.toml`
- Create: `crates/source-inventory/src/lib.rs`
- Create: `crates/source-inventory/src/image_source.rs`
- Create: `crates/source-inventory/src/platform/mod.rs`
- Create: `crates/source-inventory/src/platform/windows.rs`
- Create: `crates/source-inventory/src/platform/linux.rs`
- Create: `crates/source-inventory/src/platform/macos.rs`
- Create: `crates/source-inventory/tests/image_identity.rs`
- Create: `apps/desktop/src/renderer/features/sources/AddSourcePage.tsx`
- Create: `apps/desktop/src/renderer/features/sources/SourceCard.tsx`
- Create: `apps/desktop/src/renderer/features/sources/source-store.ts`
- Test: `apps/desktop/tests/e2e/add-image-source.spec.ts`

**Interfaces:**
- Produces `SourceInventory::list_physical_sources()` and `SourceInventory::add_image(path)`.
- Produces stable image ID from canonical path, size, file identity, and a sampled fingerprint; full hash remains an explicit job.
- Produces source-change events for connected/disconnected physical devices.

- [ ] **Step 1: Write image-identity tests**

```rust
#[test]
fn replacing_an_image_at_the_same_path_changes_stable_id() {
    let fixture = TempImage::new(b"first");
    let first = identify_image(fixture.path()).unwrap();
    fixture.replace_contents(b"second and different");
    let second = identify_image(fixture.path()).unwrap();
    assert_ne!(first.stable_id, second.stable_id);
}
```

- [ ] **Step 2: Write split-image discovery tests**

Given `disk.001`, `disk.002`, and `disk.004`, return a typed `MISSING_SEGMENT` finding for `.003`; do not silently concatenate the sequence.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p source-inventory`

Expected: FAIL.

- [ ] **Step 4: Implement image sources first**

Support `.img`, `.dd`, `.raw`, and numbered split segments. Do not implement E01 in this task. Canonicalize paths, reject directories, capture file IDs where the OS supports them, and use strings for byte sizes across RPC.

- [ ] **Step 5: Implement physical inventory without raw reads**

Inventory only:

- Windows: enumerate physical disks and volume relationships.
- Linux/BOSS: enumerate `/sys/block`, udev properties, mounts, and root-device relationship.
- macOS: use Disk Arbitration/system APIs for device metadata.

Do not elevate or open devices yet.

- [ ] **Step 6: Build Add Source UI**

Show cards for Physical Device, Disk Image, and Memory Image. Device cards use friendly names and hide raw paths under Technical Details.

- [ ] **Step 7: Run tests**

Run:

```bash
cargo nextest run -p source-inventory
pnpm --filter @recovery/desktop test:e2e -- --grep "add image source"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add crates/source-inventory apps/desktop/src/renderer/features/sources
git commit -m "feat: add source inventory and image selection"
```

---

### Task 9: Implement source assessment and the hard safety-policy engine

**Files:**
- Create: `crates/safety-policy/Cargo.toml`
- Create: `crates/safety-policy/src/lib.rs`
- Create: `crates/safety-policy/src/rules.rs`
- Create: `crates/safety-policy/src/destination.rs`
- Create: `crates/safety-policy/tests/policy_matrix.rs`
- Create: `apps/desktop/src/renderer/features/sources/SourceAssessmentPage.tsx`
- Create: `apps/desktop/src/renderer/features/sources/AssessmentFinding.tsx`
- Create: `apps/desktop/src/renderer/features/recovery/DestinationPage.tsx`
- Test: `apps/desktop/tests/e2e/safety-blocks.spec.ts`

**Interfaces:**
- Produces `SafetyPolicy::assess_source` and `SafetyPolicy::validate_destination`.
- Produces ordered `CapabilityFinding[]` with level, plain-language explanation, and recommended action.
- Hard block codes are stable public identifiers.

- [ ] **Step 1: Write policy table tests**

```rust
#[test]
fn active_system_disk_requires_rescue_for_deep_scan() {
    let result = assess(TestScenario::active_system_disk(), ScanPreset::Full, RuntimeMode::Installed);
    assert_has_code(&result, "ACTIVE_SYSTEM_DISK_REQUIRES_RESCUE");
}

#[test]
fn same_physical_source_and_destination_is_blocked() {
    let result = validate_destination(TestScenario::same_device());
    assert_eq!(result.decision, Decision::Blocked);
}
```

Add explicit cases for insufficient space, read-only destination, network destination warning, failing source, locked encryption, experimental filesystem, and source identity change.

- [ ] **Step 2: Run tests and verify failure**

Run: `cargo nextest run -p safety-policy`

Expected: FAIL.

- [ ] **Step 3: Implement deterministic rule priority**

Priority:

1. Identity mismatch.
2. Source-write requirement.
3. Same physical destination.
4. Locked encryption.
5. Current system disk.
6. Failing media.
7. Insufficient space.
8. Unsupported/experimental capability.
9. Advisory warnings.

Multiple findings may be returned, but the highest severity controls the primary action.

- [ ] **Step 4: Implement source assessment UI**

Render Ready, Rescue Mode Recommended, Failing Device, Locked Source, and Unsupported states using exact copy from the UX spec. Every finding includes “Why am I seeing this?” and Technical Details.

- [ ] **Step 5: Implement destination validation UI**

A same-device hard block has no bypass. Network destination and active-system-disk warnings require acknowledgement. Display free space and estimated reserve.

- [ ] **Step 6: Run backend and E2E tests**

Run:

```bash
cargo nextest run -p safety-policy
pnpm --filter @recovery/desktop test:e2e -- --grep "safety"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/safety-policy apps/desktop/src/renderer/features/sources apps/desktop/src/renderer/features/recovery/DestinationPage.tsx
git commit -m "feat: enforce recovery source safety policy"
```

---

### Task 10: Implement the read-only SourceReader abstraction for raw and split images

**Files:**
- Create: `crates/image-io/Cargo.toml`
- Create: `crates/image-io/src/lib.rs`
- Create: `crates/image-io/src/source_reader.rs`
- Create: `crates/image-io/src/raw.rs`
- Create: `crates/image-io/src/split.rs`
- Create: `crates/image-io/src/cache.rs`
- Create: `crates/image-io/tests/random_access.rs`
- Create: `crates/image-io/tests/split_boundaries.rs`
- Test data: `testdata/generated/raw-pattern.img`
- Test data: `testdata/generated/split-pattern.001`
- Test data: `testdata/generated/split-pattern.002`

**Interfaces:**
- Produces trait `SourceReader` from the spec.
- Produces `RawImageReader` and `SplitImageReader`.
- Provides bounded read cache and exact short-read/error ranges.

- [ ] **Step 1: Generate deterministic pattern fixtures**

Create a test generator that writes a byte pattern where byte `n` equals `n mod 251`. Split at a non-sector-aligned test boundary to prove the reader handles cross-segment reads.

- [ ] **Step 2: Write random-access tests**

```rust
#[tokio::test]
async fn reads_across_split_segment_boundary() {
    let reader = SplitImageReader::open(fixtures::split_pattern()).await.unwrap();
    let mut buf = vec![0; 8192];
    reader.read_exact_at(1_048_000, &mut buf).await.unwrap();
    assert_eq!(buf, expected_pattern(1_048_000, 8192));
}
```

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p image-io`

Expected: FAIL.

- [ ] **Step 4: Implement readers**

Requirements:

- Read-only open flags.
- Checked offset arithmetic.
- No memory-mapping of arbitrarily large images in MVP.
- Bounded 64 MiB cache by default.
- Concurrent reads capped by configuration.
- Missing segment returns a typed gap, never zero-filled silently.

- [ ] **Step 5: Add unchanged-source guard**

Capture image identity before a job and recheck size/file ID/mtime after analysis. Full source SHA-256 is calculated in a later report stage; identity change immediately invalidates the job.

- [ ] **Step 6: Run tests**

Run: `cargo nextest run -p image-io`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/image-io testdata/generated
git commit -m "feat: add read-only raw image readers"
```

---

### Task 11: Implement pinned external-tool manifests and the safe tool runner

**Files:**
- Create: `tools/manifests/tools.lock.json`
- Create: `tools/manifests/tools.schema.json`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `crates/tool-runner/Cargo.toml`
- Create: `crates/tool-runner/src/lib.rs`
- Create: `crates/tool-runner/src/manifest.rs`
- Create: `crates/tool-runner/src/process.rs`
- Create: `crates/tool-runner/src/logs.rs`
- Create: `crates/tool-runner/tests/no_shell.rs`
- Create: `crates/tool-runner/tests/hash_verification.rs`
- Create: `crates/tool-runner/tests/cancellation.rs`

**Interfaces:**
- Produces `ToolRegistry::load_and_verify`.
- Produces `ToolRunner::execute(ToolInvocation, CancellationToken)`.
- Produces normalized process events: `Started`, `StdoutLine`, `StderrLine`, `Progress`, `Exited`, `Cancelled`, `TimedOut`.

- [ ] **Step 1: Write manifest fixture and validation tests**

Manifest entry:

```json
{
  "id": "tsk-fls",
  "version": "4.15.0",
  "license": "CPL-1.0/mixed",
  "platform": "linux-x64",
  "relativePath": "tools/linux-x64/fls",
  "sha256": "<64 lowercase hexadecimal characters stored in the real manifest>",
  "networkAllowed": false
}
```

The test manifest uses a fixture binary and its real fixture hash. Production entries are generated by a checksum script and reviewed in source control.

- [ ] **Step 2: Write no-shell test**

The test passes an argument containing spaces, semicolons, and shell metacharacters and asserts the fixture process receives one literal argument. The public runner API must not expose a `shell` field.

- [ ] **Step 3: Write cancellation test**

Start a long-running fixture, cancel it, assert graceful termination is attempted first, then forced termination after the configured grace period, and raw logs remain.

- [ ] **Step 4: Run tests and verify failure**

Run: `cargo nextest run -p tool-runner`

Expected: FAIL.

- [ ] **Step 5: Implement manifest verification and execution**

Rules:

- Refuse an unknown platform/architecture.
- Verify SHA-256 before every first run per process lifetime.
- Use argument arrays and a sanitized environment.
- Unique per-job working directory.
- Bound stdout/stderr line and total sizes.
- Preserve raw logs.
- Disable network in Rescue Mode through OS policy as well as manifest intent.

- [ ] **Step 6: Add third-party notices**

Record The Sleuth Kit’s mixed licensing, TestDisk/PhotoRec GPL-2.0, libewf LGPL-3.0-or-later, YARA-X BSD-3-Clause, GNU ddrescue GPL, and the separate terms of memory tools. Do not claim that notices replace legal review.

- [ ] **Step 7: Run tests**

Run: `cargo nextest run -p tool-runner`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add tools/manifests THIRD_PARTY_NOTICES.md crates/tool-runner
git commit -m "feat: add verified forensic tool runner"
```

---

### Task 12: Implement partition discovery and lost-partition candidate analysis

**Files:**
- Create: `crates/partition-scan/Cargo.toml`
- Create: `crates/partition-scan/src/lib.rs`
- Create: `crates/partition-scan/src/tsk_mmls.rs`
- Create: `crates/partition-scan/src/testdisk.rs`
- Create: `crates/partition-scan/src/normalize.rs`
- Create: `crates/partition-scan/tests/gpt_fixture.rs`
- Create: `crates/partition-scan/tests/missing_table_fixture.rs`
- Create: `apps/desktop/src/renderer/features/recovery/GoalPage.tsx`
- Create: `apps/desktop/src/renderer/features/recovery/ScanOptionsPage.tsx`
- Create: `apps/desktop/src/renderer/features/sources/PartitionList.tsx`
- Test: `apps/desktop/tests/e2e/partition-scan.spec.ts`

**Interfaces:**
- Produces `PartitionScanner::scan(SourceReaderRef)`.
- Produces normalized `PartitionDescriptor` and `PartitionCandidate` records.
- Uses TSK `mmls`/library as primary and TestDisk read-only analysis as fallback.

- [ ] **Step 1: Create deterministic partition fixtures**

Generate:

- GPT image with EFI-like partition, NTFS partition, and a gap.
- MBR image with FAT32 partition.
- Image with removed partition table but an intact filesystem at a known offset.

Record expected offsets and lengths in `testdata/expected/partitions.json`.

- [ ] **Step 2: Write normalization tests**

```rust
#[tokio::test]
async fn reports_partition_offsets_in_bytes_and_sectors() {
    let result = scan_fixture("gpt-basic.img").await.unwrap();
    assert_eq!(result.partitions[1].start_sector, 2048);
    assert_eq!(result.partitions[1].start_offset_bytes, 1_048_576);
}
```

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p partition-scan`

Expected: FAIL.

- [ ] **Step 4: Implement TSK primary adapter**

Parse structured output or call a stable library wrapper. Preserve raw output, tool version, and sector size. If multiple plausible filesystem starts exist, return candidates rather than silently selecting one.

- [ ] **Step 5: Implement TestDisk fallback adapter**

Use scripted/read-only analysis. The adapter may identify partition candidates but must never invoke write-table or repair commands.

- [ ] **Step 6: Build goal and scan-options UI**

Implement the six goal cards and Quick/Full/Advanced presets with exact explanations from the UX specification.

- [ ] **Step 7: Run tests**

Run:

```bash
cargo nextest run -p partition-scan
pnpm --filter @recovery/desktop test:e2e -- --grep "partition scan"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add crates/partition-scan apps/desktop/src/renderer/features/recovery apps/desktop/src/renderer/features/sources/PartitionList.tsx testdata
git commit -m "feat: add read-only partition discovery"
```


---

### Task 13: Implement metadata-first deleted-file recovery with The Sleuth Kit

**Files:**
- Create: `crates/metadata-recovery/Cargo.toml`
- Create: `crates/metadata-recovery/src/lib.rs`
- Create: `crates/metadata-recovery/src/fls_adapter.rs`
- Create: `crates/metadata-recovery/src/icat_adapter.rs`
- Create: `crates/metadata-recovery/src/path_reconstruction.rs`
- Create: `crates/metadata-recovery/src/tsk_parser.rs`
- Create: `crates/metadata-recovery/tests/ntfs_deleted_tree.rs`
- Create: `crates/metadata-recovery/tests/fat_deleted_file.rs`
- Create: `crates/metadata-recovery/tests/ext4_deleted_file.rs`
- Create: `apps/desktop/src/renderer/features/jobs/stage-copy.ts`
- Test: `tests/integration/metadata_recovery.rs`

**Interfaces:**
- Produces `MetadataRecovery::scan(partition, filters, sink)`.
- Produces incremental `ArtifactDiscovered` events before scan completion.
- Produces `RecoveryArtifact` with `recoveryMethod=metadata`, provenance, paths, timestamps, and data ranges where available.

- [ ] **Step 1: Generate filesystem fixtures**

Use reproducible scripts under `testdata/scripts/` to create:

- NTFS deleted folder tree with one intact deleted file, one fragmented file, one overwritten extent, one alternate data stream, one hard link, one sparse file, and one compressed file.
- FAT32 deleted JPEG/PDF.
- ext4 deleted text/document fixture.

Store source file SHA-256 values and expected metadata in `testdata/expected/metadata-recovery.json`.

- [ ] **Step 2: Write recovery tests**

```rust
#[tokio::test]
async fn recovers_deleted_ntfs_file_with_original_path() {
    let results = scan_fixture("ntfs-deleted-tree.img").await.unwrap();
    let artifact = results.find_by_expected_id("intact_pdf").unwrap();
    assert_eq!(artifact.original_path.as_deref(), Some("/Finance/2025/report.pdf"));
    assert_eq!(artifact.recovery_method, RecoveryMethod::Metadata);
    assert_eq!(artifact.sha256.as_deref(), Some(EXPECTED_REPORT_SHA256));
}
```

Add tests proving hard-linked content is not silently collapsed, alternate streams are represented, and overwritten extents produce `PARTIAL` rather than `COMPLETE`.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p metadata-recovery`

Expected: FAIL.

- [ ] **Step 4: Implement deleted-entry enumeration**

Use TSK `fls` semantics or library APIs to enumerate deleted entries and preserve raw records. Normalize file type, metadata address, path, allocation state, timestamps, and partition offset.

- [ ] **Step 5: Implement content extraction**

Use `icat` semantics or library APIs to extract by metadata address to the job quarantine directory. Compute SHA-256 as bytes are written. Record missing/unreadable ranges and never infer completeness solely from exit code.

- [ ] **Step 6: Implement specific-file filtering**

Filters apply during enumeration when possible:

- Name contains.
- Former path contains.
- Extension/type.
- Size range.
- Date range.
- Known SHA-256 after extraction.

A known hash may confirm a result but cannot find overwritten content without bytes.

- [ ] **Step 7: Emit incremental results and stage copy**

Map technical phases to:

- “Looking for deleted file records.”
- “Recovering file content.”

UI event updates are throttled and result indexing is asynchronous.

- [ ] **Step 8: Run integration tests**

Run:

```bash
cargo nextest run -p metadata-recovery
cargo nextest run --test metadata_recovery
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add crates/metadata-recovery apps/desktop/src/renderer/features/jobs testdata tests/integration
git commit -m "feat: recover deleted files from filesystem metadata"
```

---

### Task 14: Implement PhotoRec signature carving with controlled file-family selection

**Files:**
- Create: `crates/carving/Cargo.toml`
- Create: `crates/carving/src/lib.rs`
- Create: `crates/carving/src/photorec.rs`
- Create: `crates/carving/src/config.rs`
- Create: `crates/carving/src/output_watcher.rs`
- Create: `crates/carving/src/normalize.rs`
- Create: `crates/carving/tests/command_generation.rs`
- Create: `crates/carving/tests/carve_fixture.rs`
- Create: `apps/desktop/src/renderer/features/recovery/FileFamilySelector.tsx`
- Test: `tests/integration/carving_recovery.rs`

**Interfaces:**
- Produces `Carver::run(CarveRequest, ArtifactSink, CancellationToken)`.
- Produces artifacts with `recoveryMethod=carving`, no original path/name, source signature family when available, and generated display name.
- Consumes file-family selections from `ScanOptions`.

- [ ] **Step 1: Create carving fixture**

Generate an image containing:

- Valid JPEG with metadata record removed.
- Valid PDF with metadata record removed.
- Truncated PNG.
- Random bytes containing a header-like false positive.
- ZIP-based document with a valid internal structure.

- [ ] **Step 2: Write command-generation test**

```rust
#[test]
fn full_scan_limits_photorec_to_selected_families_and_output_dir() {
    let invocation = build_invocation(test_request(&[FileFamily::Jpeg, FileFamily::Pdf])).unwrap();
    assert!(invocation.args.iter().any(|arg| arg.contains("fileopt")));
    assert_eq!(invocation.output_root, fixture_job_dir().join("photorec-output"));
    assert!(!invocation.uses_shell);
}
```

- [ ] **Step 3: Write semantic-result test**

Assert that a carved JPEG has `originalName=None`, `originalPath=None`, and display label “Recovered by content signature.”

- [ ] **Step 4: Run tests and verify failure**

Run: `cargo nextest run -p carving`

Expected: FAIL.

- [ ] **Step 5: Implement PhotoRec adapter**

Use scripted command arguments. Run against the image or a materialized partition/range view. Watch output directories, wait for file close/stability before hashing, and preserve PhotoRec session/log output.

Do not display PhotoRec’s generated filename as an original filename.

- [ ] **Step 6: Implement cancellation and partial-output preservation**

On cancellation, stop the process, finish indexing stable output files, mark the stage partial, and preserve logs. A later resume starts a new carving attempt unless a proven tool-native continuation exists.

- [ ] **Step 7: Build file-family selector**

Group types into Documents, Images, Audio/Video, Archives, Databases, Executables/Scripts, and Other. Selecting active content displays the quarantine warning.

- [ ] **Step 8: Run integration tests**

Run:

```bash
cargo nextest run -p carving
cargo nextest run --test carving_recovery
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add crates/carving apps/desktop/src/renderer/features/recovery/FileFamilySelector.tsx testdata tests/integration
git commit -m "feat: add controlled signature-based file carving"
```

---

### Task 15: Implement deterministic file validation, completeness, and duplicate grouping

**Files:**
- Create: `crates/validation/Cargo.toml`
- Create: `crates/validation/src/lib.rs`
- Create: `crates/validation/src/model.rs`
- Create: `crates/validation/src/registry.rs`
- Create: `crates/validation/src/validators/jpeg.rs`
- Create: `crates/validation/src/validators/png.rs`
- Create: `crates/validation/src/validators/pdf.rs`
- Create: `crates/validation/src/validators/zip_container.rs`
- Create: `crates/validation/src/validators/text.rs`
- Create: `crates/validation/tests/validators.rs`
- Create: `crates/validation/tests/archive_limits.rs`

**Interfaces:**
- Produces `ValidatorRegistry::validate(path, hints)`.
- Produces `ValidationOutcome { state, findings, detected_type, safe_preview_kind }`.
- Produces SHA-256 duplicate group ID without deleting evidentially distinct records.

- [ ] **Step 1: Write validator tests**

```rust
#[test]
fn truncated_png_is_partial_not_complete() {
    let outcome = validate_fixture("truncated.png");
    assert_eq!(outcome.state, RecoveryState::PartialValidated);
}

#[test]
fn header_only_false_positive_is_corrupt() {
    let outcome = validate_fixture("header-like-random.bin");
    assert_eq!(outcome.state, RecoveryState::Corrupt);
}
```

- [ ] **Step 2: Write archive safety tests**

A ZIP with path traversal, excessive expansion ratio, excessive nested depth, or too many entries must stop probing and return a safety finding. Validation does not extract it to arbitrary paths.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p validation`

Expected: FAIL.

- [ ] **Step 4: Implement validator registry**

Validators are selected by detected bytes, not extension alone. Each validator returns specific findings such as missing footer, failed CRC, invalid object table, decoder error, or unsupported encrypted container.

- [ ] **Step 5: Implement completeness rules**

Combine:

- Readable source extents.
- Expected versus recovered size where metadata exists.
- Format validation.
- Tool-reported truncation.

Do not invent a precise percentage unless total expected bytes are known.

- [ ] **Step 6: Implement duplicate grouping**

Group complete artifacts by SHA-256. Preserve every original path and recovery event. UI may collapse the group visually but export selection remains per evidential record.

- [ ] **Step 7: Run tests**

Run: `cargo nextest run -p validation`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add crates/validation
git commit -m "feat: validate recovered artifacts deterministically"
```

---

### Task 16: Implement result indexing, search, pagination, and the three-pane results UI

**Files:**
- Create: `crates/result-index/Cargo.toml`
- Create: `crates/result-index/src/lib.rs`
- Create: `crates/result-index/src/query.rs`
- Create: `crates/result-index/src/pagination.rs`
- Create: `crates/result-index/src/saved_filters.rs`
- Create: `crates/result-index/tests/million_rows.rs`
- Create: `apps/desktop/src/renderer/features/results/ResultsPage.tsx`
- Create: `apps/desktop/src/renderer/features/results/ResultFilters.tsx`
- Create: `apps/desktop/src/renderer/features/results/ArtifactTable.tsx`
- Create: `apps/desktop/src/renderer/features/results/ArtifactDetailsPanel.tsx`
- Create: `apps/desktop/src/renderer/features/results/result-store.ts`
- Test: `apps/desktop/tests/e2e/results-workspace.spec.ts`
- Test: `apps/desktop/tests/performance/million-results.spec.ts`

**Interfaces:**
- Produces `ArtifactIndex::insert_batch`, `query`, `count`, `save_filter`.
- RPC `artifact.query` accepts cursor-based pagination, sort, search, and typed filters.
- UI consumes pages without loading all artifacts into renderer memory.

- [ ] **Step 1: Write server-side query tests**

Test search by original name/path, file type, method, status, threat, size, partition, and date. Use stable cursor ordering by selected sort plus artifact ID.

- [ ] **Step 2: Write million-row performance test**

Seed one million generated rows in a temporary SQLite database and assert the first indexed query page returns under the project’s one-second test budget on the reference workstation class. Record actual timing without making validation flaky; fail only beyond an agreed generous threshold.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p result-index`

Expected: FAIL.

- [ ] **Step 4: Implement schema and FTS5 index**

Use normalized columns for exact filters and FTS5 for name/path/type text. Parameterize every query. Limit page size to 500; default 100.

- [ ] **Step 5: Build results workspace**

Implement:

- Left filters.
- Center virtualized table/grid.
- Right resizable details panel.
- Search.
- Saved filters.
- Selection basket.
- Incremental results during scanning.

Default columns and labels match the UX specification.

- [ ] **Step 6: Enforce semantic labels**

Metadata artifact: “Original name available” and “Recovered from file record.”

Carved artifact: “Original name unavailable” and “Recovered by content signature.”

No UI component may derive these labels from a generated filename.

- [ ] **Step 7: Run unit, E2E, and performance tests**

Run:

```bash
cargo nextest run -p result-index
pnpm --filter @recovery/desktop test:e2e -- --grep "results workspace"
pnpm --filter @recovery/desktop test -- million-results
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add crates/result-index apps/desktop/src/renderer/features/results
git commit -m "feat: add scalable recovered-file review workspace"
```

---

### Task 17: Implement quarantine, YARA-X threat classification, and safe previews

**Files:**
- Create: `crates/threat-scan/Cargo.toml`
- Create: `crates/threat-scan/src/lib.rs`
- Create: `crates/threat-scan/src/yara_x.rs`
- Create: `crates/threat-scan/src/quarantine.rs`
- Create: `crates/threat-scan/tests/test_rule.rs`
- Create: `tools/rules/yara/platform-test.yar`
- Create: `apps/desktop/src/renderer/features/results/PreviewPanel.tsx`
- Create: `apps/desktop/src/renderer/features/results/preview-policy.ts`
- Create: `apps/desktop/src/main/preview-worker.ts`
- Test: `apps/desktop/tests/e2e/unsafe-preview.spec.ts`

**Interfaces:**
- Produces `ThreatScanner::scan(path)`.
- Produces `PreviewPolicy::decide(artifact, validation, threat)`.
- Preview requests return sanitized derivative descriptors, never the original file path to the renderer.

- [ ] **Step 1: Write YARA-X test-rule test**

Create a harmless fixture containing `SIH_RECOVERY_TEST_PATTERN_2026`. The test rule matches it. Assert outcome `POTENTIAL_THREAT`, matched rule names, and scanner version are persisted.

- [ ] **Step 2: Write preview-policy tests**

```ts
expect(decidePreview(executableNoMatch)).toEqual({ kind: 'blocked', reason: 'active_content' });
expect(decidePreview(imageWithYaraMatch)).toEqual({ kind: 'blocked', reason: 'potential_threat' });
expect(decidePreview(validJpegNoMatch).kind).toBe('sanitized_image');
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
cargo nextest run -p threat-scan
pnpm --filter @recovery/desktop test -- preview-policy
```

Expected: FAIL.

- [ ] **Step 4: Implement YARA-X adapter**

Run through the verified tool runner or stable library API. Record rule namespace/name/tags but do not display sensitive rule source by default. `NO_RULE_MATCH` is not represented as “Safe.”

- [ ] **Step 5: Implement quarantine permissions**

On Unix, quarantine directories are mounted/configured `noexec,nodev,nosuid` where feasible. On Windows, never launch files and apply a quarantine marker/ACL policy. The case database stores the logical artifact, not a user-browsable auto-open shortcut.

- [ ] **Step 6: Implement sanitized preview workers**

- Raster image: decode and re-encode to a sanitized PNG/JPEG derivative.
- Text: bounded byte/line preview with encoding detection.
- PDF: render pages to images in an isolated worker.
- Office/archives: metadata-only in MVP.
- Executables/scripts/unknown active content: blocked.

Use a separate worker process with CPU, time, memory, and output limits.

- [ ] **Step 7: Build preview UI**

Tabs: Preview, Metadata, Recovery Evidence, Threat Check, Hex in Advanced Mode. Double click opens full details, not an operating-system application.

- [ ] **Step 8: Run tests**

Run:

```bash
cargo nextest run -p threat-scan
pnpm --filter @recovery/desktop test:e2e -- --grep "unsafe preview"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add crates/threat-scan tools/rules apps/desktop/src/renderer/features/results apps/desktop/src/main/preview-worker.ts
git commit -m "feat: quarantine and classify recovered content"
```

---

### Task 18: Implement safe verified export and recovery reports

**Files:**
- Create: `crates/exporter/Cargo.toml`
- Create: `crates/exporter/src/lib.rs`
- Create: `crates/exporter/src/path_safety.rs`
- Create: `crates/exporter/src/collision.rs`
- Create: `crates/exporter/src/verify.rs`
- Create: `crates/exporter/tests/path_traversal.rs`
- Create: `crates/exporter/tests/collisions.rs`
- Create: `crates/reporting/Cargo.toml`
- Create: `crates/reporting/src/lib.rs`
- Create: `crates/reporting/src/manifest.rs`
- Create: `crates/reporting/src/markdown.rs`
- Create: `crates/reporting/tests/report_fixture.rs`
- Create: `apps/desktop/src/renderer/features/export/ExportWizard.tsx`
- Create: `apps/desktop/src/renderer/features/reports/ReportsPage.tsx`
- Test: `apps/desktop/tests/e2e/export-report.spec.ts`

**Interfaces:**
- Produces `Exporter::export(ExportRequest, CancellationToken)` and per-file verification result.
- Produces `RecoveryReportManifest` JSON plus human-readable Markdown in MVP.
- Reserves optional `signature` field without implementing PKI.

- [ ] **Step 1: Write export path-safety tests**

Test:

- `../../escape.exe`
- absolute paths.
- Windows reserved names such as `CON` and `AUX`.
- trailing dots/spaces.
- Unicode normalization collisions.
- duplicate original paths.
- overlong path components.

Assert no output escapes the export root.

- [ ] **Step 2: Write same-device destination test**

Mock source/destination stable physical IDs and assert export is blocked before any file is written.

- [ ] **Step 3: Write report snapshot test**

The report includes case/source IDs, source geometry, image hash if available, tools and versions, method counts, quality counts, warnings, unreadable ranges, export manifest, and explicit limitations.

- [ ] **Step 4: Run tests and verify failure**

Run:

```bash
cargo nextest run -p exporter -p reporting
```

Expected: FAIL.

- [ ] **Step 5: Implement export organization modes**

- Preserve original folders where metadata supports them.
- Carved files organized by detected type.
- Flat collision-safe mode.

Default collision policy is keep both with deterministic suffix. “Skip identical hashes” is optional. Replace requires explicit confirmation.

- [ ] **Step 6: Verify every exported artifact**

Hash the exported bytes and compare with the indexed artifact hash. Mark and report failures. Export potentially unsafe files only after explicit acknowledgement and never auto-open the destination.

- [ ] **Step 7: Implement report manifest**

Use canonical field ordering for deterministic tests. Include `sourceHashBefore` and `sourceHashAfter` for image-file analysis when calculated. The two hashes must match; otherwise the report is invalid and the case enters `NEEDS_ATTENTION`.

- [ ] **Step 8: Build Export Wizard and Reports page**

Follow the six-step flow and completion copy in the UX spec. Exports are repeatable jobs; they do not mutate recovery results.

- [ ] **Step 9: Run tests**

Run:

```bash
cargo nextest run -p exporter -p reporting
pnpm --filter @recovery/desktop test:e2e -- --grep "export and report"
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add crates/exporter crates/reporting apps/desktop/src/renderer/features/export apps/desktop/src/renderer/features/reports
git commit -m "feat: add verified export and recovery reports"
```


---

### Task 19: Implement healthy physical-device acquisition and the privileged helper

**Files:**
- Create: `crates/privileged-helper/Cargo.toml`
- Create: `crates/privileged-helper/src/main.rs`
- Create: `crates/privileged-helper/src/protocol.rs`
- Create: `crates/privileged-helper/src/peer_auth.rs`
- Create: `crates/privileged-helper/src/platform/windows.rs`
- Create: `crates/privileged-helper/src/platform/linux.rs`
- Create: `crates/privileged-helper/src/platform/macos.rs`
- Create: `crates/acquisition/Cargo.toml`
- Create: `crates/acquisition/src/lib.rs`
- Create: `crates/acquisition/src/raw_copy.rs`
- Create: `crates/acquisition/src/checkpoint.rs`
- Create: `crates/acquisition/src/hash.rs`
- Create: `crates/acquisition/tests/resume.rs`
- Create: `crates/acquisition/tests/read_errors.rs`
- Create: `apps/desktop/src/renderer/features/recovery/AcquisitionOptions.tsx`
- Test: `tests/platform/raw_device_smoke.rs`

**Interfaces:**
- Produces privileged operations `list_devices`, `open_read_only`, `read_at`, `close_handle`, and no generic write/command API.
- Produces `AcquisitionEngine::create_raw_image` with SHA-256, checkpoints, and read-error map.
- Helper authenticates the calling daemon through OS peer identity and an ephemeral session token.

- [ ] **Step 1: Write protocol allowlist tests**

Assert that deserializing methods named `write`, `format`, `mount_read_write`, `run_command`, or unknown methods returns `METHOD_NOT_ALLOWED`.

- [ ] **Step 2: Write acquisition resume test**

Use a fixture `SourceReader` that terminates after a known byte offset. Restart with the checkpoint and assert completed chunks are verified and not recopied unnecessarily.

- [ ] **Step 3: Write injected read-error test**

A fixture reader returns errors for known ranges. Assert the image records gaps, the report contains unreadable ranges, and the acquisition result is `PARTIAL`, not `SUCCESS`.

- [ ] **Step 4: Run tests and verify failure**

Run:

```bash
cargo nextest run -p privileged-helper -p acquisition
```

Expected: FAIL.

- [ ] **Step 5: Implement least-privilege helper**

Windows:

- Service or elevated helper with named-pipe ACL restricted to the launching user/admin context.
- Open `PhysicalDrive` read-only.
- Resolve volume-to-disk relationships.

Linux/BOSS:

- Polkit-gated helper.
- Open `/dev/...` with read-only flags.
- Resolve `/sys/block` identity.

macOS:

- Read-only raw-device helper using supported system authorization pattern.
- Physical acquisition remains marked limited until platform tests pass.

- [ ] **Step 6: Implement raw acquisition**

- Default block size 4 MiB, aligned to sector size.
- Bounded queue and backpressure.
- Concurrent SHA-256.
- Fsync at checkpoints.
- Progress by bytes.
- Revalidate source stable ID before open and periodically after reconnect.
- Destination reserve: source size plus case overhead.

- [ ] **Step 7: Wire Installed Mode acquisition UI**

Explain when image creation is required. Show source, destination, expected size, and warning that the current system disk should use Rescue Mode.

- [ ] **Step 8: Run tests on loopback/test devices only**

Never use a developer’s real system disk in automated tests. Linux uses loop devices; Windows uses a virtual disk fixture where available; macOS uses disk images.

Run:

```bash
cargo nextest run -p privileged-helper -p acquisition
cargo nextest run --test raw_device_smoke
```

Expected: PASS on supported native hosts; capability-skipped with a stated reason elsewhere.

- [ ] **Step 9: Commit**

```bash
git add crates/privileged-helper crates/acquisition apps/desktop/src/renderer/features/recovery/AcquisitionOptions.tsx tests/platform
git commit -m "feat: add read-only physical source acquisition"
```

---

### Task 20: Add E01/Ex01 image support through libewf

**Files:**
- Create: `crates/image-io/src/ewf.rs`
- Create: `crates/image-io/tests/ewf_segments.rs`
- Create: `crates/acquisition/src/ewf_acquire.rs`
- Create: `crates/acquisition/tests/ewf_verification.rs`
- Modify: `tools/manifests/tools.lock.json`
- Modify: `THIRD_PARTY_NOTICES.md`
- Test data: `testdata/generated/ewf-small.E01`
- Test data: `testdata/generated/ewf-small.E02`

**Interfaces:**
- Produces `EwfImageReader` implementing `SourceReader`.
- Produces `EwfVerifier` normalized outcome.
- Optional acquisition method `E01` is separate from raw acquisition.

- [ ] **Step 1: Create or obtain a legally redistributable small E01 fixture**

Document how it was generated, its segment list, expected media size, and SHA-256 values. Include a corrupted copy produced by flipping bytes in a duplicate fixture.

- [ ] **Step 2: Write missing-segment and corruption tests**

Assert missing `.E02` yields `MISSING_SEGMENT`; corrupted fixture yields a verifier failure with preserved raw output.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p image-io -p acquisition -- ewf`

Expected: FAIL.

- [ ] **Step 4: Implement libewf adapter**

Prefer a stable library binding if maintainable; otherwise invoke verified `ewfinfo`, `ewfverify`, and `ewfacquire` tools through `ToolRunner`. Normalize segment order and media size.

- [ ] **Step 5: Expose E01 in image picker and acquisition options**

Show:

> E01 stores a segmented forensic image with metadata and integrity checks. RAW remains the simplest interoperable format.

- [ ] **Step 6: Run tests**

Run: `cargo nextest run -p image-io -p acquisition -- ewf`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/image-io crates/acquisition tools/manifests THIRD_PARTY_NOTICES.md testdata/generated/ewf-small.*
git commit -m "feat: add EWF forensic image support"
```

---

### Task 21: Build the Debian-based bootable Rescue Mode

**Files:**
- Create: `live/auto/config`
- Create: `live/config/package-lists/recovery.list.chroot`
- Create: `live/config/includes.chroot/etc/fstab`
- Create: `live/config/includes.chroot/etc/udev/rules.d/99-recovery-no-automount.rules`
- Create: `live/config/includes.chroot/etc/polkit-1/rules.d/50-recovery.rules`
- Create: `live/config/includes.chroot/usr/local/bin/recovery-launch`
- Create: `live/config/hooks/live/010-install-recovery-app.hook.chroot`
- Create: `live/config/hooks/live/020-disable-network-default.hook.chroot`
- Create: `live/scripts/build-live.sh`
- Create: `live/scripts/verify-live.sh`
- Create: `tests/e2e/rescue-mode.spec.ts`

**Interfaces:**
- Produces bootable ISO artifact plus SHA-256 and manifest.
- Sets runtime mode through immutable environment/config: `RECOVERY_RUNTIME_MODE=rescue`.
- Launches the same desktop package and daemon used in Installed Mode.

- [ ] **Step 1: Write static live-config tests**

Verify:

- No automount service is enabled.
- Network is disabled by default.
- Recovery app auto-launch exists.
- Source devices are not listed as writable mounts.
- Required tools and their manifests are included.

- [ ] **Step 2: Run static verification and confirm failure**

Run: `bash live/scripts/verify-live.sh`

Expected: FAIL because live configuration does not exist.

- [ ] **Step 3: Configure Debian live-build**

Use `live-build` with an x86-64 Debian Bookworm-compatible base for BOSS alignment. Include a lightweight desktop/session sufficient for Electron, storage firmware packages permitted for redistribution, polkit, udev, X/Wayland support as tested, and the recovery app `.deb`.

- [ ] **Step 4: Disable automatic source writes**

- No auto-mount daemon behavior.
- File manager does not auto-mount removable storage.
- Sources are opened through the helper read-only.
- Swap disabled by default in the live session.
- Network disabled until the operator explicitly enables it through an Advanced setting.

- [ ] **Step 5: Auto-launch the product**

`recovery-launch` verifies app/tool manifests, creates a volatile session directory, sets Rescue Mode, then starts the Electron app. On failure, show a local diagnostic screen and preserve logs to an explicitly selected destination.

- [ ] **Step 6: Build and boot-test in QEMU/VM**

Test UEFI and legacy BIOS. Attach:

- ISO.
- Read-only source fixture disk.
- Writable destination fixture disk.

Assert the app shows Rescue Mode, lists both disks, does not mount the source, and allows image acquisition only to the destination.

- [ ] **Step 7: Generate ISO integrity outputs**

Produce:

```text
recovery-rescue-<version>-x86_64.iso
recovery-rescue-<version>-x86_64.iso.sha256
recovery-rescue-<version>-x86_64.manifest.json
```

- [ ] **Step 8: Run verification**

Run:

```bash
bash live/scripts/build-live.sh
bash live/scripts/verify-live.sh
pnpm playwright test tests/e2e/rescue-mode.spec.ts
```

Expected: PASS in the ISO build runner.

- [ ] **Step 9: Commit**

```bash
git add live tests/e2e/rescue-mode.spec.ts
git commit -m "feat: add bootable recovery Rescue Mode"
```

---

### Task 22: Add the damaged-device workflow with GNU ddrescue

**Files:**
- Create: `crates/acquisition/src/ddrescue.rs`
- Create: `crates/acquisition/src/damage_policy.rs`
- Create: `crates/acquisition/tests/ddrescue_parser.rs`
- Create: `crates/acquisition/tests/ddrescue_resume.rs`
- Create: `apps/desktop/src/renderer/features/recovery/DamagedDeviceWizard.tsx`
- Create: `apps/desktop/src/renderer/features/jobs/ReadErrorMap.tsx`
- Modify: `tools/manifests/tools.lock.json`
- Modify: `THIRD_PARTY_NOTICES.md`
- Test: `tests/e2e/damaged-device.spec.ts`

**Interfaces:**
- Produces `DdrescueAdapter::first_pass`, `retry_pass`, `resume`.
- Produces normalized progress and mapfile summary.
- Available only in Rescue Mode for MVP.

- [ ] **Step 1: Write parser tests with recorded ddrescue status fixtures**

Normalize rescued bytes, error size, error areas, current rate, average rate, and current pass. Invalid lines are retained in raw logs and do not crash the job.

- [ ] **Step 2: Write resume test**

Use a fault-injecting block-device fixture or device-mapper target. Interrupt the first pass, preserve mapfile, resume, and assert the adapter reuses the same mapfile and destination.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p acquisition -- ddrescue`

Expected: FAIL.

- [ ] **Step 4: Implement damage policy**

If source health/read behavior suggests failure:

- Recommend image-first.
- Default to a healthy-regions-first pass with minimal retries.
- Require explicit operator choice for aggressive retry passes.
- Never run repeated metadata/carving scans directly against the failing device.

- [ ] **Step 5: Implement adapter**

Use verified ddrescue executable, destination image, and persistent mapfile. Preserve command arguments and version in evidence. Cancellation sends an interrupt and waits for mapfile flush.

- [ ] **Step 6: Build Damaged Device Wizard**

Explain:

> Repeated reading can worsen a failing device. Rescue Mode will first copy the easiest-to-read areas and record unreadable regions so the job can resume.

Options:

- First pass only, recommended.
- Additional limited retry pass.
- Expert retry configuration under Advanced Details.

- [ ] **Step 7: Run tests**

Run:

```bash
cargo nextest run -p acquisition -- ddrescue
pnpm playwright test tests/e2e/damaged-device.spec.ts
```

Expected: PASS on the Linux/Rescue validation host.

- [ ] **Step 8: Commit**

```bash
git add crates/acquisition apps/desktop/src/renderer/features/recovery/DamagedDeviceWizard.tsx apps/desktop/src/renderer/features/jobs/ReadErrorMap.tsx tools/manifests THIRD_PARTY_NOTICES.md tests/e2e/damaged-device.spec.ts
git commit -m "feat: add resumable damaged-media acquisition"
```

---

### Task 23: Add memory-image analysis and optional authorized acquisition

**Files:**
- Create: `crates/memory-analysis/Cargo.toml`
- Create: `crates/memory-analysis/src/lib.rs`
- Create: `crates/memory-analysis/src/volatility.rs`
- Create: `crates/memory-analysis/src/winpem.rs`
- Create: `crates/memory-analysis/src/avml.rs`
- Create: `crates/memory-analysis/src/lime.rs`
- Create: `crates/memory-analysis/src/plugin_schema.rs`
- Create: `crates/memory-analysis/tests/volatility_json.rs`
- Create: `crates/memory-analysis/tests/missing_symbols.rs`
- Create: `apps/desktop/src/renderer/features/memory/MemorySourcePage.tsx`
- Create: `apps/desktop/src/renderer/features/memory/MemoryOptionsPage.tsx`
- Create: `apps/desktop/src/renderer/features/memory/MemoryResultsPage.tsx`
- Modify: `tools/manifests/tools.lock.json`
- Modify: `THIRD_PARTY_NOTICES.md`
- Test: `apps/desktop/tests/e2e/memory-analysis.spec.ts`

**Interfaces:**
- Produces `MemoryAnalyzer::detect`, `run_plugin`, `run_preset`.
- Produces structured tables for processes, command lines, network connections, loaded modules/drivers, and YARA findings.
- Memory acquisition is a separate explicit operation with authorization warning.

- [ ] **Step 1: Write Volatility JSON normalization tests**

Provide recorded fixture output for process list and network connections. Normalize columns into typed records without exposing arbitrary plugin output directly to the renderer.

- [ ] **Step 2: Write missing-symbol and unsupported-image tests**

Assert the user-facing outcome includes:

- Detected probable OS.
- Plugin attempted.
- Missing symbol/profile explanation.
- Suggested supported next step.

Do not return a generic process failure only.

- [ ] **Step 3: Run tests and verify failure**

Run: `cargo nextest run -p memory-analysis`

Expected: FAIL.

- [ ] **Step 4: Implement Volatility 3 adapter**

Use machine-readable output. Presets:

- Processes and command lines.
- Network connections.
- Loaded modules/drivers.
- YARA-X scan.

Record plugin version, symbol identifiers, raw output, and normalized rows.

- [ ] **Step 5: Implement optional acquisition adapters**

Windows WinPmem:

- Elevated, explicit authorization.
- Output to a different destination.
- Record acquisition method and hash.

Linux/BOSS AVML/LiME:

- Prefer AVML where compatible.
- Detect kernel lockdown or unavailable sources and explain.
- LiME requires a matching kernel module and is an expert path.

macOS live-memory acquisition remains unsupported in MVP.

- [ ] **Step 6: Build separate memory UI**

Do not mix memory results into disk artifacts. Show the warning that capture changes the running system and cannot be perfectly non-invasive.

- [ ] **Step 7: Run tests**

Run:

```bash
cargo nextest run -p memory-analysis
pnpm --filter @recovery/desktop test:e2e -- --grep "memory analysis"
```

Expected: PASS for fixture analysis. Acquisition tests are capability-gated and never run against the developer’s real memory without an explicit test harness.

- [ ] **Step 8: Commit**

```bash
git add crates/memory-analysis apps/desktop/src/renderer/features/memory tools/manifests THIRD_PARTY_NOTICES.md
git commit -m "feat: add memory image analysis workflow"
```

---

### Task 24: Package for Windows, BOSS/Debian, and macOS; add toolchain integrity

**Files:**
- Modify: `apps/desktop/forge.config.ts`
- Create: `apps/desktop/entitlements.mac.plist`
- Create: `packaging/linux/recovery-platform.desktop`
- Create: `packaging/linux/recovery-platform.polkit`
- Create: `packaging/windows/service-install.ps1`
- Create: `packaging/scripts/stage-tools.ts`
- Create: `packaging/scripts/verify-package.ts`
- Create: `docs/operations/manual-release.md`
- Create: `tests/platform/boss10-install.sh`
- Create: `tests/platform/package-integrity.test.ts`

**Interfaces:**
- Produces signed-capable Windows installer, BOSS/Debian `.deb`, optional AppImage, macOS DMG, and package manifest.
- Bundles daemon/helper/tool assets with verified hashes.
- Auto-update is disabled in the air-gapped build profile.

- [ ] **Step 1: Write package-integrity test**

The test unpacks a distributable, verifies every bundled executable against the package manifest, asserts no development server URL exists, and confirms the renderer CSP/security fuses.

- [ ] **Step 2: Write BOSS installation test**

In a BOSS 10 VM or reproducible BOSS-derived test runner:

```bash
sudo dpkg -i recovery-platform_*.deb
sudo apt-get -f install -y
recovery-platform --version
recoveryd --version
```

Launch the app, open a raw fixture, and run the vertical-slice smoke test.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm test -- package-integrity`

Expected: FAIL.

- [ ] **Step 4: Configure Electron Forge makers**

- Windows: signed-capable installer appropriate to deployment policy.
- Linux: `.deb` mandatory, AppImage optional.
- macOS: DMG and ZIP for tested architectures.

Use Electron 44 stable and Node 24 LTS build tooling. Production signing identities remain in protected certificate/keychain storage on the native build host; no private certificate is committed.

- [ ] **Step 5: Stage native binaries by platform**

`stage-tools.ts` reads `tools.lock.json`, copies only matching platform/architecture assets, writes a package manifest, and fails if any checksum or license metadata is missing.

- [ ] **Step 6: Add air-gapped profile**

- No telemetry.
- No automatic network calls.
- No automatic updates.
- Local offline help.
- Signed offline update package can be a later project.

- [ ] **Step 7: Run package tests**

Run on each native platform build host:

```bash
pnpm --filter @recovery/desktop make
pnpm test -- package-integrity
bash tests/platform/boss10-install.sh
```

Expected: PASS on relevant jobs.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/forge.config.ts apps/desktop/entitlements.mac.plist packaging docs/operations/manual-release.md tests/platform
git commit -m "build: package recovery platform across target systems"
```

---

### Task 25: Build the deterministic forensic test corpus and fault-injection suite

**Files:**
- Create: `testdata/scripts/create-fat32.sh`
- Create: `testdata/scripts/create-exfat.sh`
- Create: `testdata/scripts/create-ntfs.ps1`
- Create: `testdata/scripts/create-ext4.sh`
- Create: `testdata/scripts/create-partition-loss.sh`
- Create: `testdata/scripts/create-carving-fixture.py`
- Create: `testdata/expected/*.json`
- Create: `tests/fault-injection/source_disconnect.rs`
- Create: `tests/fault-injection/destination_full.rs`
- Create: `tests/fault-injection/daemon_kill.spec.ts`
- Create: `tests/fault-injection/tool_crash.rs`
- Create: `tests/fault-injection/corrupt_case.rs`
- Create: `tests/security/path_traversal.rs`
- Create: `tests/security/malicious_metadata.rs`
- Create: `docs/testing/test-corpus.md`

**Interfaces:**
- Produces reproducible fixture images and expected truth manifests.
- Produces validation groups `unit`, `integration`, `fault`, `security`, `platform`, and `e2e`.

- [ ] **Step 1: Write fixture reproducibility test**

Generate each fixture twice and compare the declared logical content manifest. Where filesystem timestamps or IDs prevent byte-identical images, normalize expected truth and document nondeterministic fields.

- [ ] **Step 2: Add ground-truth manifests**

Each expected file record includes:

```json
{
  "fixtureId": "ntfs-deleted-tree",
  "artifactId": "intact_pdf",
  "originalPath": "/Finance/2025/report.pdf",
  "sha256": "...",
  "expectedMethods": ["metadata"],
  "expectedState": "complete_validated"
}
```

- [ ] **Step 3: Implement fault injection**

Cover:

- Source disconnected and same device reconnected.
- Different device appears at the same mount path.
- Destination full.
- Destination disconnected.
- Daemon killed.
- Tool killed.
- Tool emits malformed output.
- Corrupt SQLite/WAL copy.
- Missing split-image segment.
- Read-error ranges.
- Network destination timeout.

- [ ] **Step 4: Implement malicious metadata tests**

Inputs include extremely long names, invalid Unicode, path traversal, reserved names, HTML/script text in filenames, oversized tool lines, and archive bombs. Assert no XSS, path escape, renderer crash, or unbounded resource use.

- [ ] **Step 5: Add NIST CFReDS validation lane**

Document selected public datasets, expected findings, license/storage requirements, and a manual or scheduled validation workflow. Do not make large external datasets required for every pull request.

- [ ] **Step 6: Run the full suite**

Run:

```bash
pnpm test
cargo nextest run --workspace
pnpm test:e2e
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add testdata tests docs/testing
git commit -m "test: add forensic corpus and recovery fault injection"
```

---

### Task 26: Complete security hardening, performance budgets, documentation, and SIH demo

**Files:**
- Create: `SECURITY.md`
- Create: `docs/security/threat-model.md`
- Create: `docs/security/electron-checklist.md`
- Create: `docs/security/recovered-content-policy.md`
- Create: `docs/operations/rescue-mode-guide.md`
- Create: `docs/operations/boss10-deployment.md`
- Create: `docs/operations/recovery-limitations.md`
- Create: `docs/demo/sih-demo-script.md`
- Create: `docs/demo/demo-fixtures.md`
- Create: `docs/benchmarks/reference-results.md`
- Create: `tests/security/electron-fuses.test.ts`
- Create: `tests/security/ipc-fuzz.rs`
- Create: `tests/performance/ui-responsiveness.spec.ts`
- Create: `tests/performance/scan-throughput.rs`

**Interfaces:**
- Produces a release-candidate checklist and reproducible SIH demonstration.
- Produces published limitation wording used by the UI/report.

- [ ] **Step 1: Write the threat model**

Threats include:

- Malicious disk metadata.
- Malicious recovered files.
- Compromised installed OS.
- Fake device at same path.
- Tool-binary replacement.
- IPC abuse from renderer frames.
- Path traversal on export.
- Resource-exhaustion images.
- Case tampering.
- Accidental source writes.

For each, document trust boundary, control, test, and residual risk.

- [ ] **Step 2: Add Electron security assertions**

Verify packaged fuses, CSP, sandbox, context isolation, blocked navigation, blocked external links unless allowlisted, sender validation, permission denial, and absence of development tools in release.

- [ ] **Step 3: Fuzz RPC and parser boundaries**

Fuzz NDJSON frames, size limits, invalid enums, duplicate IDs, unexpected events, tool-output parsers, and malformed filenames. A malformed input returns a typed error and does not terminate the daemon.

- [ ] **Step 4: Measure performance budgets**

Reference workstation results must include:

- Raw sequential acquisition throughput.
- Metadata scan time for each fixture.
- Carving throughput by file-family selection.
- Hashing throughput.
- First-page search latency at one million rows.
- Renderer long-task count during scan.
- Memory use during large result review.

Do not hard-code marketing numbers before measurement.

- [ ] **Step 5: Write the exact SIH demo script**

Demo sequence:

1. Launch Installed Mode on BOSS 10 or Windows.
2. Create a case.
3. Open the NTFS fixture.
4. Quick Scan recovers a deleted PDF with original path.
5. Full Scan carves a JPEG with “Original name unavailable.”
6. Open Advanced Details and show byte ranges, tool version, and hash.
7. Show a YARA-X test match blocking preview.
8. Export selected safe files to another destination and verify hashes.
9. Kill/restart the app and resume a scan.
10. Boot Rescue Mode in a prepared machine/VM and show no automount plus physical imaging.
11. Show a failing-media ddrescue map/resume scenario.
12. Open a memory fixture and display process/network results.
13. Generate the recovery report and limitations.

- [ ] **Step 6: Write limitation documentation**

It must state plainly:

- TRIM/overwriting may make recovery impossible.
- Carving does not restore original names/folders.
- Experimental filesystem support is limited.
- Locked encryption needs authorized keys.
- Memory capture changes the running system.
- Installed Mode is not equivalent to a trusted rescue environment.

- [ ] **Step 7: Run release-candidate verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo nextest run --workspace
pnpm test:e2e
pnpm --filter @recovery/desktop make
bash live/scripts/verify-live.sh
```

Expected: every required job passes; platform-specific skips contain a documented capability reason.

- [ ] **Step 8: Commit**

```bash
git add SECURITY.md docs tests/security tests/performance
git commit -m "docs: harden and document recovery release candidate"
```

---

## 3. Milestone acceptance gates

### Milestone A — Image-file vertical slice

Tasks 1–18 complete.

Gate:

- Raw image opens.
- Partitions detected.
- Deleted metadata file recovered with original path.
- Carved file recovered without fabricated path.
- Result validated, indexed, previewed safely, exported, and reported.
- Source image hash unchanged.
- Job resumes after app termination.

Do not begin physical-device work until this gate passes.

### Milestone B — Physical acquisition and Rescue Mode

Tasks 19–22 complete.

Gate:

- Healthy test device imaged read-only.
- Same-device destination blocked.
- Rescue ISO boots with no automount.
- App shows identical case/UI behavior in Rescue Mode.
- Interrupted ddrescue acquisition resumes from mapfile.

### Milestone C — Memory and platform delivery

Tasks 23–26 complete.

Gate:

- Supported memory fixture produces normalized process/network results.
- BOSS 10 `.deb` installation passes.
- Windows and macOS packages open image fixtures.
- Full fault/security suite passes.
- SIH demo runs from a clean scripted setup.

---

## 4. Edge-case completion checklist

Before declaring recovery feature complete, verify that each item has an automated test or a documented capability-based refusal:

- [ ] Active system disk.
- [ ] Source and destination same device.
- [ ] Source disappears.
- [ ] Different source appears at same path.
- [ ] Destination fills.
- [ ] Destination disconnects.
- [ ] Bad sectors/read timeouts.
- [ ] SSD/TRIM limitation wording.
- [ ] Locked encryption.
- [ ] Unsupported filesystem.
- [ ] Missing/corrupt partition table.
- [ ] Hybrid/inconsistent GPT/MBR.
- [ ] 512/4096 sector sizes.
- [ ] Missing split-image segment.
- [ ] Corrupt E01.
- [ ] NTFS sparse/compressed/ADS/hard links.
- [ ] Fragmented and partially overwritten files.
- [ ] APFS/ReFS limitation behavior.
- [ ] RAID/LVM detection without unsafe auto-assembly.
- [ ] Carving false positive.
- [ ] Archive bomb/path traversal.
- [ ] Potentially malicious recovered file.
- [ ] One million indexed results.
- [ ] Daemon/tool/application crash.
- [ ] Power interruption checkpoint behavior.
- [ ] Missing memory symbols.
- [ ] Linux kernel-lockdown memory acquisition failure.
- [ ] BOSS 10 package and live-mode test.
- [ ] Keyboard, screen-reader status, dark mode, and 200% text zoom.

---

## 5. Codex execution rules

1. Read `docs/specs/recovery-module.md` and `docs/ux/recovery-ui-spec.md` before Task 1.
2. Create a dedicated feature branch or worktree.
3. Execute one task at a time.
4. Write the specified failing test first.
5. Run it and capture the expected failure.
6. Implement only enough to pass the current task plus global constraints.
7. Run task tests and relevant regression tests.
8. Commit with the specified message.
9. Do not widen filesystem support based on an unverified library assumption.
10. Do not replace a typed limitation with a guessed fallback.
11. Do not use mock success in the SIH demo path; fixture data is allowed, simulated tool completion is not.
12. Never invoke external tools through a shell string.
13. Never let recovered data enter the renderer as executable/active content.
14. Never test destructive or raw-device behavior against a developer’s real system disk.

---

## 6. Self-review of this plan

### Spec coverage

Covered:

- Electron and native backend separation.
- Installed Mode and Rescue Mode.
- BOSS Linux packaging.
- Specific and whole-source recovery.
- Image-first workflow.
- Filesystem metadata recovery.
- Signature carving.
- Partition-loss discovery.
- Damaged-media acquisition.
- E01 support.
- RAM-image analysis and optional acquisition.
- Read-only and source/destination safety.
- Plain-language UI plus advanced detail.
- Result validation, threat classification, safe preview, export, and report.
- Crash, disconnect, full-disk, parser, malware, large-result, and unsupported-capability cases.
- Test corpus, performance, security, and SIH demonstration.

Deliberately excluded according to scope:

- Secure deletion/sanitization.
- In-place repair.
- Password cracking.
- Apple Silicon rescue boot.
- Full APFS/ReFS metadata recovery.
- Arbitrary RAID reconstruction.
- Production certificate PKI.

### Placeholder scan

The plan contains no implementation placeholders. Tool checksum examples explicitly instruct the implementation to generate and commit real hashes before execution; production binaries are never accepted with example hashes.

### Type consistency

- `SourceDescriptor`, `RecoveryArtifact`, `JobStage`, `CapabilityFinding`, and RPC method names match the product specification.
- Byte counts use decimal strings across JavaScript and `u64` inside Rust.
- Job-stage names remain consistent across contracts, engine, UI, and reports.
- `SourceReader`, `ToolAdapter`, and `RecoveryEngine` interfaces are introduced before consuming tasks.

---

## 7. Final definition of done

The recovery module is done when a user can run the same branded application in Installed Mode or Rescue Mode, select an authorized source, receive a clear safety assessment, image the source when appropriate, recover through metadata and carving, understand exactly what was and was not recovered, safely review and export results, resume interrupted work, analyze a supported memory image, and generate a reproducible report—without any code path writing to the source or pretending that unsupported recovery is possible.
