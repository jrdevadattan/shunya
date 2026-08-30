# Task 6 — Memory capability, case activity, and settings

## Outcome

Completed the approved memory capability, case activity, and settings workspaces without extending the renderer API or fabricating forensic state.

- Memory Source now renders only registered `memory_image` source identity and exact decimal-string size data returned by `source.list`. Volatility runtime, symbol, and finding states are explicitly unavailable because the desktop API exposes no verified runtime-capability method.
- Memory Options contains no fake runnable checkboxes. Process, network, module, registry, and YARA surfaces are explanatory and locked. Memory Results remains separate from disk results and renders only a typed memory job state when one actually exists.
- Case Activity is assembled from the persisted case identity plus ordered daemon `JobEvent` records for the active job. Live matching events are appended by sequence and duplicates are ignored. Audit record IDs, hashes, hash-chain validation, and integrity status are explicitly unavailable.
- Settings persists only the existing theme and sidebar-collapse preferences. Read-only source handling, separate export topology, and protected preview are shown as immutable safety invariants without fake inputs. Daemon-backed defaults without a persisted settings API are explanatory and locked.
- Help and About remain truthful and use the same application shell and visual language.

## RED evidence

The focused RED run was captured after adding the four Task 6 renderer expectations:

```text
vitest run tests/integration/live-renderer.test.tsx -t "shows registered memory|labels memory analysis|assembles case activity|persists supported appearance"

4 failed, 75 skipped
```

The failures were the expected missing behaviors:

1. Registered memory-image identity and exact size were absent.
2. Memory options still rendered disabled checkbox controls instead of locked capability explanations.
3. Case Activity was still a placeholder and exposed no case/job timeline.
4. Settings exposed no persisted appearance controls or immutable safety presentation.

All failures were assertion failures against the existing rendered behavior, not import, fixture, or setup errors.

## GREEN evidence

The first focused GREEN run passed:

```text
1 test file passed
4 Task 6 tests passed, 75 skipped
```

A pre-existing Settings copy assertion then caught one regression in the full renderer run. Root cause was an exact sentence boundary changed while preserving the same meaning; the copy was restored without changing the new behavior. The rerun passed all 82 live-renderer and UI-preference tests.

## Verification

| Gate | Result |
| --- | --- |
| Focused Task 6 renderer RED → GREEN | PASS — 4 tests |
| Full desktop Vitest suite | PASS — 9 files, 108 tests |
| Live renderer + persisted UI preferences | PASS — 2 files, 82 tests |
| Shared UI accessibility suite | PASS — 2 files, 7 tests |
| Workspace TypeScript typecheck | PASS — contracts, UI, desktop |
| Packaging/security tests | PASS — 16 passed, 1 expected Windows Unix-mode skip |
| Fresh Electron Forge Windows package | PASS |
| Fresh packaged memory Playwright flow | PASS — 1 test |
| `git diff --check` | PASS (repository CRLF warnings only) |

No contracts or Rust production code changed in Task 6, so no contract extension or Rust behavior test was required. The full desktop security tests still cover the unchanged IPC/preload boundary.

## Truth and safety notes

- The approved mockups depict SHA-256 memory identity, Python/Volatility status, symbol packs, advanced findings, and audit hash-chain records. None of those values are exposed by the current typed desktop API, so this implementation does not display them as real.
- Registered source `stableId` is not relabeled as a verified hash.
- Activity actors are limited to “Local case store” and “Recovery daemon,” derived from the actual producer. No local-user action, export, report, record hash, or chain verification is invented.
- Settings does not imply that checkpoint cadence, verification policy, storage headroom, runtime installation, or other recovery defaults can be persisted.

Final same-state screenshot comparison against the approved memory, activity, and settings references remains part of Task 7 visual QA.

## Fix Round 1 — auditable capability state

### Review corrections

- Application theme observation now uses an explicit effect cleanup return. The original concise arrow expression already returned `applyTheme`'s cleanup, so the review's listener-leak premise did not reproduce; the new regression test proves that later system-theme events cannot override explicit light or dark preferences across mode transitions.
- Case Activity is now a persistent case-scoped item in the approved Cases navigation group. Its route receives `aria-current="page"`, making the screen discoverable without opening command search.
- Registered memory-image summaries now expose the typed source kind, complete `stableId`, and raw `sizeBytes` decimal string. A rounded binary-unit label remains supplementary. The regression fixture uses `9007199254740993`, above JavaScript's safe-integer limit, and verifies the exact string survives rendering.
- Activity timestamps retain the service's raw ISO value in `<time dateTime>` and render a deterministic UTC display label, removing workstation-timezone ambiguity.

### RED → GREEN evidence

The focused review run produced three expected failures: missing exact memory identity/bytes, no current persistent Activity navigation item, and no visible timezone. The theme-transition test passed immediately because cleanup already occurred through the concise effect return.

After the minimal production changes, the same focused run passed all four tests. The broader live-renderer and UI-preference run then passed 86 tests.

Fresh Fix Round 1 verification passed: full desktop Vitest (112 tests), shared UI/accessibility (7 tests), workspace typechecks, packaging/security (16 passed plus the expected Windows Unix-mode skip), Electron Forge Windows packaging, and three packaged Playwright flows covering memory, Activity navigation/timestamps, and persisted Settings.
