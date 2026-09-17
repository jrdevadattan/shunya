# Task 5 — Results, export, and reports

## Outcome

Recomposed the Results, Artifact Evidence, Export Wizard, and Reports workspaces around live daemon data while preserving pagination, concurrency, preview, verification, and destination-safety invariants.

The approved Option 1 layout is implemented with Lucide icons and semantic controls. Folder groupings are derived only from metadata-recovered artifacts with daemon-provided original paths; carved artifacts are never assigned fabricated folders or original paths.

## RED evidence

The first focused run was made after adding the new integration and preview-policy expectations:

```text
..\..\node_modules\.bin\vitest.cmd run tests/integration/preview-policy.test.ts tests/integration/live-renderer.test.tsx

preview-policy.test.ts: 2 passed
live-renderer.test.tsx: 6 failed as expected
```

The six failures covered the approved folder/filter rail and semantic table, selected-artifact evidence and selection summary, method filtering, renderer-side active-content refusal, bounded complete-cursor export traversal, and report output.

Two additional focused RED cycles caught gaps before implementation completion:

- SVG/executable MIME aliases and the rule that a carved artifact must not acquire an original-folder grouping: 2 expected failures.
- Export topology messaging before cursor traversal resolves the live source identity: 1 expected failure.

## GREEN evidence

The first focused GREEN run produced:

```text
2 test files passed
67 tests passed
```

The subsequent policy, provenance, and pending-topology tests also passed after their corresponding minimal production changes.

## Implementation notes

- Results uses the typed live artifact query, preserves generation and cursor guards, and exposes method and real-path folder filters.
- The artifact list is a semantic table with keyboard-accessible row selection and export checkboxes.
- The evidence panel reports provenance, recovery quality, threat state, SHA-256, and decimal-string source ranges without coercing large offsets through JavaScript numbers.
- Preview remains protected by both daemon policy and renderer-side defense in depth. Active, malicious, corrupt, and unscanned content is refused; unsupported content remains metadata-only. Original content is never embedded or launched.
- Export traverses every cursor before submission, rejects duplicate cursors and premature count termination, computes exact totals with `bigint`, and keeps the rendered summary bounded for million-result cases.
- Export refuses unsafe topology and incomplete/mixed verification states and does not auto-open the destination.
- Reports expose daemon-recorded paths and limitations and explicitly state that only daemon-recorded evidence is included.
- Responsive layout, visible focus, reduced motion, and zoom-friendly overflow are retained.

## Verification

| Gate | Result |
| --- | --- |
| Desktop TypeScript (`tsc --noEmit`) | PASS |
| Full desktop Vitest suite | PASS — 9 files, 96 tests |
| Focused results/export/report and preview policy coverage | PASS |
| Million-result store and bounded complete-cursor traversal coverage | PASS |
| Shared UI accessibility/axe suite | PASS — 2 files, 7 tests |
| Packaging/security test set | PASS — 16 passed, 1 expected Windows Unix-mode skip, 0 failed |
| Electron Forge Windows package | PASS |
| Packaged Task 5 Playwright flows | PASS — results workspace, unsafe preview, export/report; 3 tests |
| `git diff --check` | PASS (repository CRLF warnings only) |
| Prohibited handcrafted SVG/CSS/raster-placeholder scan | PASS |

The focused packaged E2E suite was run against a freshly built package after the final production change.

## Known limitation outside Task 5

The broader legacy `partition-scan.spec.ts` still stops at its pre-Task-5 `New recovery case` locator. The approved intake UI now uses the `New recovery` entry and a multi-step native-picker flow, so that stale test does not reach the Results workspace. The Task 5 packaged flows all pass; updating that earlier intake test belongs to its owning task rather than this change.

Final same-state screenshot comparison remains part of the plan's Task 7 visual-QA gate. This implementation was grounded in the four approved Results, Artifact Detail, Export, and Report references.

## Fix Round 1 — verified export and exact folder filtering

### Correction to the initial report

The initial report overstated the phrase “refuses incomplete/mixed verification states.” The first implementation detected incomplete post-copy hash results, but it did not refuse artifacts whose recovery state was not `complete_validated` before submission. Post-copy hash verification is not a substitute for recovery-state validation. Fix Round 1 adds the required pre-submit refusal in both the renderer and daemon.

### RED evidence

- Renderer integration: 8 expected failures covering a real folder-prefix query, the four canonical disallowed states (`complete_unverified`, `partial_validated`, `partial_unverified`, and `corrupt`), a mixed validated/unverified selection, a missing explicit ID, and duplicate explicit IDs.
- Contract test: `originalPathPrefix` was discarded instead of normalized.
- Result-index test: the wished-for `original_path_prefix` field did not compile.
- Daemon integration: an unverified artifact reached destination-topology validation and returned `EXPORT_DESTINATION_NOT_SEPARATE` instead of the earlier `EXPORT_SELECTION_NOT_VERIFIED` refusal.
- The corrected million-result assertion passed immediately because the implementation already renders exactly 50 `<li>` rows. The repeated-cursor regression also passed immediately because the existing traversal guard already refused it; neither required a production change.

### GREEN evidence

| Gate | Result |
| --- | --- |
| Focused renderer integration | PASS — 75 tests |
| Contracts | PASS — 13 tests |
| Result-index focused query tests | PASS — 2 tests |
| Recovery-daemon verified-selection boundary | PASS |
| Full desktop typecheck and Vitest | PASS — 9 files, 104 tests |
| Relevant Rust crates | PASS — daemon unit and recovery-flow suites, result-index queries, and one-million-row test |
| Relevant Rust Clippy (`-D warnings`) | PASS |
| Shared UI accessibility/axe | PASS — 7 tests |
| Packaging/security | PASS — 16 passed, 1 expected Windows Unix-mode skip |
| Fresh Electron Forge Windows package | PASS |
| Fresh packaged Task 5 Playwright flows | PASS — 3 tests |

### Result

- Only `complete_validated` artifacts can enter the verified export call. All other canonical recovery states and mixed sets are refused before submission, and the daemon independently enforces the same rule before topology or copy work.
- Folder selection now sends a typed `originalPathPrefix`, normalized to `/` separators. Result-index applies a segment-boundary prefix over metadata artifacts with real paths, so `Users` does not match `Users2`, display names, MIME text, carved artifacts, or pathless artifacts. Cursor pagination and filtered counts remain server-side.
- Persisted explicit selections fail closed when IDs are duplicated or absent after full cursor traversal, with guidance to return to Results. A stale selection is never silently reduced and submitted.

The workspace-wide formatter check continues to report formatting drift in pre-existing case-store and platform files outside Task 5. Touched Rust hunks were formatted, targeted Clippy passes, and unrelated files were preserved.

## Fix Round 2 — case-insensitive Windows path families

RED was captured with a focused result-index regression: selecting `users\\Maya` returned zero rows for the stored path `Users/Maya/file.txt`. The test also included `Users2/Maya/other.txt` to retain the segment-boundary refusal.

The normalized predicate now applies bound SQLite `NOCASE` comparison to the prefix segment while retaining the separate `/` boundary check. No `LIKE` expression is constructed, so `%` and `_` remain literal path characters rather than wildcards. Metadata-only and non-null-path constraints, separator normalization, filtered count parity, and cursor pagination are unchanged.

Because source filesystem case sensitivity is not represented in the typed contract, `originalPathPrefix` deliberately uses the same SQLite `NOCASE` segment semantics on every platform. This satisfies the approved Windows flow (`users/Maya` and `Users/Maya` are the same path family). SQLite `NOCASE` is ASCII-oriented; broader Unicode filesystem case folding is not claimed.

Focused GREEN passed, followed by contracts typecheck/tests (13), full desktop typecheck/tests (104), relevant daemon and result-index suites including the one-million-row test, and targeted Clippy with warnings denied.

The normalized `ltrim(replace(...))` path predicate is not currently index-backed and can require a full scan for filtered count and page queries. That is a recorded future optimization risk; no speculative generated column or schema migration was added without a focused measurement demonstrating the need.
