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
