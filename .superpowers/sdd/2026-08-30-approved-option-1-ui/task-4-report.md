# Task 4 report — live recovery and damaged-media workspaces

## Scope and baseline

- Base commit: `6e84c9a7b5fe276d1139ae4c0ae8cc837b29be07`.
- Reworked `JobProgressPage`, `ReadErrorMap`, and `DamagedDeviceWizard` against the approved SHUNYA Option 1 progress and damaged-media references.
- Preserved the existing `JobStatus`/`JobEvent` parsing, non-overlapping polling loop, event cursor sequence, request-generation stale-response guard, terminal polling stop, and pause/resume/cancel command calls.
- Used only typed job stage, source ID, preset, partitions, timestamps, limitations, events, and stored case workspace data. The current contract exposes no throughput, ETA, byte progress, file count, checkpoint/mapfile, physical-device descriptor, destination assessment, health, or read-range telemetry.

## RED evidence

Command:

`corepack pnpm --filter @recovery/desktop exec vitest run tests/integration/live-renderer.test.tsx`

Observed before production edits:

- 5 new tests failed and 53 existing tests passed.
- Missing behaviors were the recovery stage timeline label/disclosure, source-to-workspace relationship, checkpoint unavailable state, read-error legend without a synthetic map, and the damaged-media capability workspace.
- Failure output showed the old generic metric grid, no relationship figure, no checkpoint surface, a required numeric read map, and only one disabled damaged-device action.

A later truthfulness edge case was also driven through RED:

`corepack pnpm --filter @recovery/desktop exec vitest run tests/integration/live-renderer.test.tsx -t "does not assign a workflow percentage"`

- 1 test failed because paused jobs displayed an invented `50%` and marked the preparation stage paused.
- The implementation now removes the progress bar/percentage for paused, needs-attention, cancelling, cancelled, and failed states and leaves all workflow stages unpositioned/pending.

## GREEN evidence

Fresh final verification:

- `corepack pnpm --filter @recovery/ui test` — 7/7 passed.
- `corepack pnpm --filter @recovery/desktop test` — 86/86 passed across 9 files, including 59 live-renderer tests and the job store test.
- `corepack pnpm --filter @recovery/desktop typecheck` — passed (`tsc --noEmit`).
- `corepack pnpm --filter @recovery/desktop build` — passed; Electron Forge packaged Windows x64 successfully at `apps/desktop/out/SIH Recovery Platform-win32-x64`.
- `corepack pnpm --filter @recovery/desktop exec playwright test tests/e2e/job-resume.spec.ts tests/e2e/active-job-reload.spec.ts tests/e2e/damaged-device.spec.ts` — 3/3 passed against the freshly packaged app.
- `git diff --check` — passed; only Git's existing LF-to-CRLF notices were emitted.

## Delivered behavior

- Five-stage horizontal stage timeline with an explicitly labelled stage-based position, not measured byte progress.
- Honest position-unavailable treatment for control/exception states that do not identify a workflow stage.
- Live source ID → scan preset → stored case workspace relationship.
- Daemon-derived partition count and last-update time beside explicit throughput unavailability.
- Append-only event stream using parsed `JobEvent` sequence, message/stage, and occurrence time.
- Read-error legend that keeps rescued/unreadable/pending slots visible but renders no chart or percentage unless all three measurements are supplied.
- Checkpoint surface stating that no checkpoint time, byte range, or mapfile is reported.
- Pause/resume/cancel controls retain their previous visibility and command semantics; terminal jobs retain the no-controls state.
- Damaged-media workspace mirrors the approved source → engine → working-image, read-map, strategy, device-response, and controls layout while every unsupported slot and action remains explicitly unavailable/disabled.
- Lucide icons only; no raster placeholders, handcrafted SVG, or simulated heat maps.

## E2E maintenance

The relevant packaged E2E tests initially could not reach Task 4 assertions because shared helpers still assumed the pre-Task-2 single-screen case form, pre-Task-3 goal links/sidebar labels, and a package-local Electron install. The helpers now create their scoped fixture case through the existing typed preload API, seed the same case workspace session key used by the renderer, use current route semantics, and locate either workspace-local or monorepo-hoisted Electron. This does not alter application behavior.

## Known capability gaps

- Throughput, ETA, measured byte progress, recovered item count, sector/range maps, device health, checkpoint/mapfile details, and damaged-media acquisition controls remain unavailable because the typed desktop API does not expose them.
- The UI intentionally reserves those visual slots with explanatory unavailable states. Adding real values requires a separately specified and tested daemon/contract extension.
