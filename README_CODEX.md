# SIH 26149 Recovery Module — Codex Handoff

This pack defines the **recovery/retrieval module only** for the SIH 26149 platform. It does not implement secure deletion or sanitization.

## Read in this order

1. `docs/specs/recovery-module.md` — product, architecture, supported scope, backend contracts, safety rules, and acceptance criteria.
2. `docs/ux/recovery-ui-spec.md` — screen-by-screen UI, click behavior, plain-language copy, advanced details, and error states.
3. `docs/superpowers/plans/2026-08-29-recovery-platform.md` — test-driven implementation tasks in execution order.
4. `docs/architecture/ADR-001-dual-runtime.md` — why the product has both Installed Mode and Rescue Mode.
5. `docs/architecture/ADR-002-external-tool-adapters.md` — how forensic tools are integrated without coupling the UI to command-line output.

## Instruction to Codex

Implement the plan task-by-task. Do not start with raw physical-disk access. First complete the vertical slice that opens a supplied raw image, discovers partitions, recovers deleted files from metadata, carves files when metadata is absent, reviews results, and exports them safely. Only after that slice passes its tests should you add physical-device acquisition, the bootable live environment, damaged-media handling, and memory-image analysis.

Use test-driven development. Do not silently widen scope. When a filesystem, encryption scheme, device topology, or operating-system behavior is unsupported, return a typed `UNSUPPORTED` or `LIMITED` result with a user-readable explanation. Never claim that every edge case is solved.

## Non-negotiable constraints

- The source is read-only. No code path may repair, mount read-write, undelete in-place, change a partition table, or export to the source device.
- The installed Electron application and the bootable Rescue Mode use the same UI, domain model, case format, and Rust recovery core.
- Electron is the user interface and orchestration layer. Raw-device access, forensic parsing, tool execution, hashing, and case integrity live outside the renderer.
- The renderer has no Node.js integration, no raw `ipcRenderer` exposure, no arbitrary shell access, and no direct filesystem access.
- Recovered files are untrusted. Store them in quarantine, never auto-open executables or active content, and scan them before preview or export.
- A carved file normally has no trustworthy original name or folder. The UI must state this instead of inventing structure.
- The app must support BOSS GNU/Linux 10 as a first-class Linux target.
- Rescue Mode MVP is x86-64 UEFI/legacy BIOS. Apple Silicon boot support is outside the MVP.

## Definition of the first successful demonstration

1. Start the Electron app.
2. Create a case.
3. Open a deterministic NTFS raw image containing allocated files, deleted files, a fragmented file, and unallocated data.
4. Run a Quick Scan and recover a deleted file with its original name and path through filesystem metadata.
5. Run a Deep Scan and recover a second file through signature carving with the label “Original name unavailable.”
6. Show source offset, recovery method, completeness, hashes, and warning status.
7. Export selected files to a different destination.
8. Generate a recovery report and verify that the source image hash is unchanged.
9. Kill the app during a scan, reopen the case, and resume without restarting completed phases.

