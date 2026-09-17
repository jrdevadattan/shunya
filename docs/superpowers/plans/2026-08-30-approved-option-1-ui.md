# Approved Option 1 UI Implementation Plan

**Spec authority:** `docs/specs/recovery-module.md`

**Visual authority:** the user-approved Option 1 SHUNYA Recovery mockup family generated on 30 August 2026. The workspace-selection attachment is `C:\Users\JRDEVA~1\AppData\Local\Temp\codex-clipboard-dda3487b-3d9b-4fd4-8127-60c8ab0def6e.png`; the rest of the approved screens are under `C:\Users\J R Deva Dattan\.codex\generated_images\01a04c5e-cc02-7363-80ae-2e874bc16528\`.

**Goal:** Rebuild the existing Electron renderer around the approved light, infographic-first visual system while preserving daemon-backed truth, security boundaries, read-only source safety, typed limitations, existing recovery behavior, and cross-platform packaging.

## Global constraints

- Match the approved Option 1 system: off-white app background, white surfaces, thin warm-gray borders, bold black hierarchy, orange active/primary actions, green verified/safe states, crisp outline icons, persistent left sidebar, generous spacing, and information graphics that explain the workflow.
- Preserve the existing React/Electron/Rust architecture and public daemon contracts unless a test proves a contract extension is necessary.
- Renderer screens may visualize only values returned by typed APIs or values derived transparently from those values. Never invent forensic findings, device health, throughput, free space, hashes, partitions, capabilities, or completion.
- When an approved mockup depicts a capability the daemon does not expose, render a truthful unavailable/limited state and supported next action rather than simulated success.
- The source remains read-only. Never add source-write, repair, overwrite, execute-active-content, or generic filesystem APIs to the renderer.
- Folder trees and storage infographics must come from a native dialog response scoped to the folder the user selected; do not expose arbitrary renderer filesystem reads.
- Use the existing `lucide-react` icon system because it is already the product's supplied icon library and visually matches the approved outline iconography. Do not handcraft SVG or CSS illustration assets.
- Keep light, dark, and system theme support, keyboard focus, semantic landmarks, screen-reader labels, reduced motion, and 200% text zoom behavior.
- Follow strict TDD: add the failing behavioral test, run and capture RED, implement the smallest behavior, then run GREEN and relevant regressions.
- No CI/CD, push, release publication, macOS validation, or BOSS/WSL testing in this plan. Windows package/launch verification is the final local gate.

## Task 0: Preserve and commit the existing folder-picker safety fix

Review the existing dirty changes in the preload error adapter and Rust case store. Confirm that an existing empty folder selected by the native dialog initializes atomically, a non-empty folder is refused, Electron/daemon wrappers become useful user-facing messages, and the focused TypeScript/Rust tests pass. Make no unrelated changes. Commit as `fix: accept empty workspace destinations`.

## Task 1: Establish the approved design foundation and navigation shell

Add failing UI-package and renderer tests for the approved orange/green token mapping, SHUNYA wordmark treatment, persistent sidebar information architecture, active route state, footer status block, and responsive/collapsed semantics. Rework shared tokens, `AppShell`, case navigation, `CaseLayout`, and the welcome/case home screen to match the approved shell without changing daemon loading behavior. Add real routes for Settings and Help/About surfaces only where they can be truthful; unavailable actions must explain why. Verify UI package tests, renderer integration tests, accessibility checks, and typecheck.

## Task 2: Build friendly case intake, native workspace inspection, and review

Write failing contract, preload, main-process, and renderer tests for a scoped native workspace-selection result containing the selected path, drive label/root, total/free byte counts as decimal strings, and a bounded directory tree. The method must open a native folder dialog and inspect only its returned selection; cancellation returns `null`; permission errors become typed/useful messages; traversal depth and entry count are bounded. Extend the typed preload API without exposing an arbitrary-path filesystem method.

Rebuild case intake as a three-step Details → Workspace → Review experience. The workspace step must show the selected folder tree, editable case folder name, destination path preview, free/required/headroom visualization when known, and clear empty/non-empty behavior. The review step summarizes only real form and selection data before calling `case.create`. Preserve all required fields and navigation on success. Verify contract, preload security, main IPC, live renderer, and typecheck tests.

## Task 3: Recompose source, safety, goal, scan, destination, and partition flows

Write failing integration/E2E tests for semantic workflow steps, live source cards, safety relationship diagrams, goal selection, scan comparison, partition tree/map, and destination limitations. Rebuild `WorkflowFrame`, Add Source, Source Assessment, Goal, Scan Options, Destination, Acquisition Options, and Partition List to match the approved screens while preserving handlers and daemon-derived state. Physical-device, file-family, destination-assessment, and acquisition controls remain disabled with explicit explanations when the typed API does not support them. Starting a scan must retain current job creation/start semantics and error behavior. Verify focused renderer tests, source/safety E2E, and typecheck.

## Task 4: Implement the approved live recovery and damaged-media workspaces

Add failing tests for the stage timeline, stage-based progress disclosure, source-to-workspace relationship, event stream, read-error legend, controls, checkpoints, and damaged-media capability states. Recompose `JobProgressPage`, `ReadErrorMap`, and `DamagedDeviceWizard` to match the approved progress and imaging visuals using only `JobStatus`, `JobEvent`, partition, limitation, and acquisition data that actually exists. Do not fabricate throughput or sector heat maps when the daemon does not return them; show an honest unavailable state in the same visual slot. Preserve polling generation, cursor sequence, stale response protection, terminal-state behavior, and pause/resume/cancel semantics. Verify job-store/live-renderer tests, job E2E, damaged-device E2E, and typecheck.

## Task 5: Build results, protected detail, export, and report workspaces

Add failing tests for the approved folder/filter rail, semantic artifact table, selected artifact evidence panel, protected preview policy, selection summary, complete cursor traversal for export, destination safety messaging, verification status, and report output. Recompose Results, filters, artifact table/detail, preview, Export Wizard, and Reports using live API data only. Tree groupings may be derived from artifact paths but carved artifacts must never receive fabricated original folders. Preserve concurrency guards, preview refusal, export topology refusal, mixed verification refusal, report limitations, and all pagination behavior. Verify integration, million-result, preview-policy, result/export/report E2E, accessibility, and typecheck.

## Task 6: Complete memory capability, case activity, and settings screens

Add failing tests for a truthful memory capability screen, append-only local activity presentation from available case/job data, and persisted appearance/safety preferences. Recompose Memory Source/Options/Results to match the approved capability screen without fabricated Volatility output. Replace the activity placeholder with a real timeline assembled only from available case identity and daemon job events; label unavailable audit-hash-chain data as unavailable instead of inventing it. Build Settings around existing theme/sidebar preferences and read-only safety invariants; controls without persisted backend support are explanatory/locked. Verify memory E2E, live renderer, preference tests, accessibility, and typecheck.

## Task 7: Design QA, regression verification, Windows package, and visible launch

Run the Product Design design-QA loop against the approved workspace screen at the same 1440 × 1024 state and against focused regions for typography, spacing, colors, icons, folder tree, storage visualization, and CTA placement. Save `design-qa.md` with source/implementation evidence and `final result: passed` only when no P0/P1/P2 differences remain.

Run fresh formatting, lint, typecheck, TypeScript tests, focused Rust tests, applicable packaged E2E, and Windows package verification. Build the Windows package, launch the fresh executable visibly, leave it open for user review, and record exact package/executable paths. Do not push or publish in this task.

