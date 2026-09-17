# Task 7 — design QA, lifecycle repair, regression, Windows package, and launch

## Outcome

Task 7 passed. The approved workspace composition was matched at 1440 × 1024 within the typed product truth boundary, the user-reported folder-picker and case-lifecycle failures were repaired with strict RED/GREEN coverage, packaged actions were audited, the stale partition and image-source E2E flows were updated, and the fresh Windows package is open for inspection.

## User-reported blockers and root causes

1. **Folder picker glitched/closed:** two rapid activations reached `chooseWorkspaceFolder` before React committed the disabled state, creating competing native modal requests. RED observed two calls. An immediate `useRef` latch reduces this to one; cancel then rechoose remains possible. GREEN observed one rapid-call invocation and two total after cancel/rechoose.
2. **Created case absent from Cases:** successful creation stored only session context, while Cases hardcoded recent history as unavailable. A bounded local registry now stores exactly `caseId`, `title`, `operator`, `workspacePath`, and `createdAt`; it deduplicates, caps at 12, filters invalid entries, tolerates corrupt/unavailable storage, and never stores notes/reference/organization.
3. **Recent/Open actions did not continue:** `/cases/open` incorrectly rendered the new-case wizard, and Continue caused a second `openCase` in `CaseLayout`. A dedicated existing-workspace flow now validates through the daemon before mutation; a one-render transient validated-case handoff prevents the duplicate open while refresh/direct routes still reopen through the daemon.
4. **No job after case creation:** this is correct until source + recovery goal + scan preset exist. Creation now routes to Sources. Overview explicitly says `No recovery job yet` and explains the three required choices; no job is fabricated.
5. **Buttons appeared inert:** the packaged matrix found no invisible overlay or pointer-event interception. Slow source RPCs had no pending UI, so Refresh/Add looked inactive. Both now lock synchronously with immediate refs and display truthful pending labels.
6. **Stale E2E:** partition scan and add-image-source tests used removed intake locators. Both now use the current typed/package flow.

## RED → GREEN evidence

- Folder rapid double activation: RED 2 calls; GREEN 1 call, then 2 only after cancel/rechoose.
- Folder-tree semantics: RED 2 `Folder preview` labels; GREEN exactly 1.
- Recent registry: missing module RED; GREEN 3 persistence/deduplication/bounds/corruption tests.
- Cases home/reopen/create routing/no-job guidance: 4 focused renderer RED failures; GREEN.
- `/cases/open`: 2 focused RED failures; GREEN dedicated picker/open flow.
- Duplicate recent open: focused actual-layout RED stalled on the second `openCase`; GREEN renders overview with exactly 1 call.
- No-job artifact request: focused RED remained on loading when artifact query never settled; GREEN renders immediately without querying artifacts when no job ID exists.
- Source pending feedback: RED could not find `Refreshing…`; GREEN inventory and image pending-state test passes. A same-tick rapid Refresh RED made 3 total inventory calls (initial + 2); GREEN makes 2 (initial + 1), while rapid Add makes exactly 1 request.
- Packaged lifecycle stale-bundle RED had a manifest but no recent entry after reload; final packaged UI lifecycle GREEN includes Create → Sources, reload persistence, Continue, no-job truth, five-field storage, no notes, and corrupt-storage recovery.

## Verification commands and results

| Command | Result |
| --- | --- |
| `cargo fmt --all -- --check` | Expected pre-existing unrelated formatter drift only in untouched case-store/daemon/platform files; recorded below. |
| `pnpm -r lint` | PASS — contracts, UI, desktop. |
| `pnpm -r typecheck` | PASS — contracts, UI, desktop. |
| `pnpm -r test` | PASS — contracts 13, UI 7, desktop 121; 141 total. |
| `cargo test -p recovery-daemon -p recovery-ipc -p case-store` | PASS — case lifecycle 5, daemon unit 4, recovery flow 11, IPC unit 1, RPC roundtrip 2. |
| package/security Node test set | PASS — 16 passed, 1 expected Windows Unix-mode skip. |
| `electron-forge package` via workspace pnpm | PASS — fresh win32-x64 Forge package. |
| packaged action smoke | PASS — 2 tests; all enabled actions frontmost after scroll and route/state assertions green. |
| full packaged Playwright | PASS — 18/18 in 1.4 minutes. |
| `git diff --check` | PASS; repository CRLF conversion warnings only. |

The unrelated formatter drift predates Task 7 and is not in the Task 7 diff: `crates/case-store/src/lib.rs`, `crates/case-store/tests/case_lifecycle.rs`, `crates/recovery-daemon/tests/recovery_flow.rs`, and `tests/platform/raw_device_smoke.rs`.

## Visual evidence

- Source: `C:\Users\JRDEVA~1\AppData\Local\Temp\codex-clipboard-dda3487b-3d9b-4fd4-8127-60c8ab0def6e.png`.
- Final full capture: `.superpowers\sdd\2026-08-30-approved-option-1-ui\evidence\implementation-faithful-workspace-1440x1024.png`.
- Focused captures: `implementation-faithful-sidebar.png`, `implementation-faithful-typography-steps.png`, `implementation-faithful-folder-tree.png`, `implementation-faithful-storage.png`, `implementation-faithful-cta.png`.
- Native packaged capture: `implementation-workspace-1440x1024.png` and its focused regions.
- Detailed comparison and truth rulings: `design-qa.md` (`final result: passed`).

## Package and visible launch

- Package directory: `C:\Users\J R Deva Dattan\Desktop\sih\apps\desktop\out\SIH Recovery Platform-win32-x64`.
- Executable: `C:\Users\J R Deva Dattan\Desktop\sih\apps\desktop\out\SIH Recovery Platform-win32-x64\recovery-platform.exe`.
- Executable size: 244,441,088 bytes.
- Build timestamp: `2026-08-30T21:48:38.3077127+05:30`.
- SHA-256: `49322BF74E0E40C15737D4C82B4DDC77DC2689AC530FC822E6E39105ADC82672`.
- Visible process: PID `20148`, window title `Recovery Platform`, responding at verification time.

No push, publish, release, CI/CD, WSL/BOSS Linux, or macOS test was performed.
