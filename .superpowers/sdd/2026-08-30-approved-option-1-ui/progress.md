# SDD ledger — plan: C:\Users\J R Deva Dattan\Desktop\sih\docs\superpowers\plans\2026-08-30-approved-option-1-ui.md

## Preflight

- Branch: `feature/recovery-platform` in the existing checkout.
- Baseline: 53 desktop tests passed, desktop typecheck passed, 4 case-store lifecycle tests passed.
- Saved Product Design context: none; the user-approved mockup family is the visual authority.
- Ruling: Work in the existing dedicated feature branch instead of creating a linked worktree — the checkout contains the earlier uncommitted folder-picker/case-store fix that must be preserved and a new worktree would omit it — cost if wrong: reduced isolation from unrelated changes in this checkout.
- Ruling: Treat `docs/specs/recovery-module.md` as product authority and the approved mockups as visual authority; where a mock depicts unavailable daemon data, render an explicit limitation rather than invented values — cost if wrong: some screens will differ from the idealized mock in their live content state.
- Ruling: Preserve case-first creation semantics and adapt the approved intake wizard to Details → Workspace → Review because source APIs require an opened case — cost if wrong: the intake step labels differ from the selected Source → Workspace → Review mockup.
- Ruling: Use the existing Lucide icon library because it is already supplied by the product and matches the approved outline iconography — cost if wrong: a few glyph silhouettes may differ slightly from the raster mockups.

## Plan consistency scan

| Producer task | Consumer task | Shared file/interface | Finding |
| --- | --- | --- | --- |
| 0 | 2 | preload error adapter and `case.create` behavior | Compatible; Task 2 builds richer selection on top of the existing safe empty-folder behavior. |
| 1 | 2 | shared tokens, AppShell, case intake shell | Compatible; Task 2 consumes the foundation without redefining it. |
| 1 | 3 | shared tokens, AppShell, WorkflowFrame | Compatible; Task 3 consumes the shared shell. |
| 1 | 4 | tokens and page layout | Compatible; Task 4 adds operational visualizations only. |
| 1 | 5 | tokens, page toolbar, cards | Compatible; Task 5 consumes the same visual primitives. |
| 1 | 6 | navigation and settings route | Compatible; Task 1 registers truthful routes, Task 6 supplies their content. |
| 2 | 3 | case workspace and destination selection state | Compatible; Task 2 owns case intake selection, Task 3 owns recovery destination limitation/state. |
| 3 | 4 | active source/job identifiers and WorkflowFrame | Compatible if current session/route state remains preserved. |
| 3 | 5 | artifact-producing recovery job | Compatible; Task 5 remains daemon-driven. |
| 4 | 6 | job events for case activity | Compatible; Task 6 may derive only an honest local timeline from available events. |
| 5 | 6 | result/report routes and shared toolbar | Compatible; no contract conflict. |
| 1-6 | 7 | implementation and approved visual truth | Compatible; Task 7 is verification only. |

| Task | Internal consistency check | Finding |
| --- | --- | --- |
| 0 | Existing tests vs. existing implementation | Consistent; baseline is green and task is preservation/commit. |
| 1 | Shared shell tests vs. visual foundation | Consistent. |
| 2 | Native picker tree vs. renderer filesystem boundary | Consistent only with a dialog-scoped typed result; arbitrary path inspection is forbidden. |
| 3 | Approved controls vs. current API support | Potential visual gap resolved by explicit unavailable states, per product spec. |
| 4 | Approved charts vs. current job schema | Potential data gap resolved by omitting/fencing unavailable throughput and heat maps. |
| 5 | Approved folder tree vs. carved artifact truth | Consistent when trees derive only from metadata paths; carved items remain separate. |
| 6 | Approved audit hash chain vs. absent audit API | Potential data gap resolved by plain event timeline and explicit unavailable integrity detail. |
| 7 | Windows verification vs. no WSL/BOSS/macOS testing request | Consistent; only Windows package/launch is in scope now. |

Task 0: fix round 1/5 (1 addressed, 0 open — broken symlink destination refusal; commits 80112e9..78e4eb7)
Task 0: complete (commits 97de302..78e4eb7, review clean)
Task 1: minor (deferred): AppShell `data-height` metadata still says 48 while the header token is 64.
Task 1: fix round 1/5 (2 addressed, 0 open — `/cases/open` active navigation and stale AppShell height metadata; commits 4b66f9b..65c4848)
Task 1: complete (commits 78e4eb7..65c4848, review clean)
Task 2: fix round 1/5 (4 addressed, 0 open — root containment/cycle safety, parent-child collision guidance, accessible read-only tree semantics, normalized relative-path contract; commits 8caeebf..b77ea95)
Task 2: complete (commits 65c4848..b77ea95, review clean)
Task 3: fix round 1/5 (4 addressed, 0 open — specialized goal routing, candidate partition visualization, stale route-state clearing, exact partition byte labels; commits 664a7e3..11cdadd)
Task 3: fix round 2/5 (3 addressed, 0 open — boundary-visible candidate markers, exact source-size labels, specialized CTA copy; commits 11cdadd..6e84c9a)
Task 3: complete (commits b77ea95..6e84c9a, review clean)
Task 4: fix round 1/5 (2 addressed, 0 open — Rescue Mode damaged-device guidance and semantic event-log accessibility; commits cee9ef3..c7d7493)
Task 4: complete (commits 6e84c9a..c7d7493, review clean)
Task 5: fix round 1/5 (4 addressed, 0 open — verified-only export, typed folder-prefix filtering, fail-closed explicit selections, meaningful bounded-render test; commits 9512781..7ff89d0)
Task 5: fix round 2/5 (1 addressed, 0 open — case-insensitive Windows path-family matching; commits 7ff89d0..790d8b5)
Task 5: complete (commits c7d7493..790d8b5, review clean)
Task 6: fix round 1/5 (3 addressed, 0 open — activity navigation, auditable memory identity/exact size, timezone-explicit activity; theme cleanup premise disproved and behavior regression added; commits f95195b..e3c0d93)
Task 6: complete (commits 790d8b5..e3c0d93, review clean)
Task 7: fix round 1/5 (folder-picker rapid activation, recent-case persistence/reopen, truthful no-job flow, current `/cases/open`, source pending feedback with same-tick action latches, stale packaged locators; 0 open)
Task 7: Product Design QA passed at 1440 × 1024 with no P0/P1/P2 differences after documented typed-truth exclusions.
Task 7: complete (full TypeScript, focused Rust, package/security, Forge Windows package, and 18/18 packaged E2E green; fresh executable launched visibly)
