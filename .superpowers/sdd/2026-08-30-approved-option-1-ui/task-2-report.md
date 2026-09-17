# Task 2 report — guided case workspace intake

## Scope delivered

- Replaced the string-only workspace picker result with a strict typed native result containing the selected path, root path/label, total/free bytes as precision-safe decimal strings, and a directory-only tree.
- Kept inspection dialog-scoped: the renderer can request the folder dialog but cannot pass an arbitrary path to an inspection, directory-listing, file-reading, or shell method.
- Added native storage inspection and directory enumeration in Electron main with a maximum depth of 3 and maximum returned entry count of 200. Files and symlinks are not returned as directory nodes.
- Preserved native cancellation as `null` and mapped `EACCES`/`EPERM` to `WORKSPACE_PERMISSION_DENIED` plus useful operator guidance.
- Rebuilt new-case intake as Details → Workspace → Review. All prior case fields remain present: title, operator, reference number, organization, notes, and workspace destination.
- Changed workspace semantics from “selected folder must itself be empty” to “select a parent and create a named child”. Existing non-empty parents are shown in the native directory tree and remain valid; an already-present child name is refused before creation.
- Added a live free-versus-used storage visualization from native `freeBytes`/`totalBytes`. No required-space, headroom, device-health, or source estimate is invented. The UI explains that a requirement is unavailable until a source is selected.
- Preserved navigation to `/cases/:caseId/overview` after successful `case.create` and retained the existing case-store persistence path.

## TDD RED evidence

Tests were edited before production code. The following RED command was run against the Task 1 baseline (`65c4848`):

```text
corepack pnpm --filter @recovery/contracts test -- --run packages/contracts/tests/domain.test.ts
corepack pnpm --filter @recovery/desktop test -- --run tests/security/preload-surface.test.ts tests/security/ipc-boundary.test.ts tests/integration/live-renderer.test.tsx
```

Expected RED observations:

- Contracts: 2 failures, 4 passes. Both new workspace-result tests failed because `WorkspaceFolderResultSchema` still expected a string.
- Desktop: 8 failures, 55 passes.
  - Preload rejected the new structured native result and did not adapt permission errors.
  - Main IPC still returned only a string path, had no bounded directory/storage inspector, and exported no inspection behavior for the permission-boundary test.
  - Renderer still rendered the previous one-page form and had no Details/Workspace/Review step semantics.
- The failures named the missing production behaviors; existing unrelated tests remained green.

## GREEN implementation sequence

1. Added recursive strict workspace directory/result contracts, decimal byte validation, and shared depth/entry limits.
2. Implemented dialog-selected native inspection in Electron main using `statfs(..., { bigint: true })` and directory-only `readdir` traversal.
3. Updated the narrow preload method to parse the structured response and added useful permission-error adaptation.
4. Replaced the one-page renderer form with the three-step intake, controlled field preservation, native tree, editable child name, destination preview, truthful storage display, review summary, accessible alerts, step focus, and keyboard-operable controls.
5. Added responsive styling using the Task 1 token foundation and existing Lucide icons only.

## Focused GREEN evidence

```text
corepack pnpm --filter @recovery/contracts test -- --run tests/domain.test.ts
```

- 1 file passed; 6 tests passed.

```text
corepack pnpm --filter @recovery/desktop test -- --run tests/security/preload-surface.test.ts tests/security/ipc-boundary.test.ts tests/integration/live-renderer.test.tsx
```

- The desktop Vitest configuration executed the complete desktop test set: 9 files passed; 63 tests passed.
- Main IPC tests exercised a real temporary directory, confirmed files were excluded, confirmed a renderer-supplied path was ignored, verified cancellation, and verified the 3-level/200-entry caps.
- Renderer integration covered all three steps, real folder-tree display, preserved fields, editable child destination, truthful capacity copy, exact `case.create` payload, and an accessible permission error.

## Final regression gate

Fresh final commands run before the commit:

```text
corepack pnpm --filter @recovery/contracts test
corepack pnpm --filter @recovery/ui test
corepack pnpm --filter @recovery/desktop test
corepack pnpm -r typecheck
git diff --check
```

Results:

- Contracts: 1 file, 6/6 tests passed.
- UI foundation/accessibility: 2 files, 7/7 tests passed.
- Desktop: 9 files, 63/63 tests passed.
- TypeScript: contracts, UI, and desktop typechecks passed.
- `git diff --check`: exit 0. Git reported only the repository's Windows LF→CRLF conversion notices; no whitespace errors were reported.

## Security and truthfulness audit

- Renderer API surface still has no generic IPC, `readFile`, `writeFile`, `openPath`, `inspectPath`, `listDirectory`, or command method.
- Main ignores arguments supplied to `dialog.choose_workspace`; it inspects only `dialog.showOpenDialog`'s selected path.
- The tree returns directories only and is bounded both by traversal implementation and output schema.
- Storage arithmetic stays `bigint` in main and crosses IPC as decimal strings. Renderer formatting converts only small unit-scaled values, avoiding precision loss.
- Review renders only entered case data and native selection data.
- The source-write safety messaging and Task 1 `AppShell` foundation remain unchanged.

## Concerns / deferred verification

- Native Windows dialog interaction is not automatable through the current packaged Playwright harness, so packaged case-lifecycle E2E was not run in this task. The contract, main IPC, preload, and live renderer layers required by Task 2 are covered by automated tests; a manual packaged native-dialog check remains appropriate in Task 7.
- The bounded tree is intentionally a preview, not a filesystem browser. When the depth or entry cap is reached, the UI labels the result as partial and offers another native selection.

## Review fix round 1/5 — workspace inspection hardening

### Findings verified

- The original traversal trusted `Dirent.isDirectory()` and recursively joined paths without `lstat`, `realpath`, canonical root-containment, or visited-target checks. A directory-like reparse fixture could therefore be followed outside the selected root or back to a previously traversed target.
- `relativePath` accepted absolute paths, drive paths, UNC paths, and parent escapes.
- The preload destination-collision adapter still instructed the operator to choose an empty folder, contradicting the parent + named child flow.
- The read-only directory preview used `tree`/`treeitem` roles without the focus or keyboard interaction required for an ARIA tree widget.

### Round 1 RED evidence

Tests were changed before production code and run with:

```text
corepack pnpm --filter @recovery/contracts test -- --run tests/domain.test.ts
corepack pnpm --filter @recovery/desktop test -- --run tests/security/ipc-boundary.test.ts tests/security/preload-surface.test.ts tests/integration/live-renderer.test.tsx
```

Observed RED:

- Contracts: 6 failures, 6 passes. Absolute, drive-rooted, UNC, slash-parent, and backslash-parent paths were all accepted.
- Desktop: 6 failures, 60 passes.
  - Main returned Windows-native `Evidence\\Cases` rather than a normalized `Evidence/Cases` contract path.
  - Canonical-root escape, symbolic-directory, and visited-cycle fixtures were all included in the output.
  - Preload returned the stale “Choose an empty folder” copy.
  - Renderer still exposed `tree`/`treeitem` roles and no read-only folder-list label.

### Minimal fixes

- Added a normalized relative-path contract that permits only non-empty forward-slash segments and rejects absolute, drive, UNC, empty, dot, and parent segments.
- Added native `lstat` and `realpath` operations to inspection. The selected root is canonicalized once; every candidate must be a real directory, must not be symbolic, must canonicalize inside the selected root, and must not have a canonical target already in the visited set.
- Unsafe platform directory names are omitted, and emitted relative paths use normalized forward slashes on every platform.
- Updated the existing-destination message to direct the operator to another case-folder name or parent.
- Replaced non-functional ARIA tree roles with ordinary nested-list semantics and a `Folder preview` accessible label.

### Round 1 GREEN evidence

Focused GREEN run:

```text
corepack pnpm --filter @recovery/contracts test -- --run tests/domain.test.ts
corepack pnpm --filter @recovery/desktop test -- --run tests/security/ipc-boundary.test.ts tests/security/preload-surface.test.ts tests/integration/live-renderer.test.tsx
```

- Contracts: 12/12 passed.
- Desktop: 66/66 passed, including 9 main IPC boundary tests and the renderer accessibility assertion.
- The first typecheck identified one pre-existing permission-error fixture that needed the newly required `lstat`/`realpath` dependency members; after completing that fixture, desktop and contracts typechecks both passed.

Final round 1 regression gate:

```text
corepack pnpm --filter @recovery/contracts test
corepack pnpm --filter @recovery/ui test
corepack pnpm --filter @recovery/desktop test
corepack pnpm -r typecheck
git diff --check
```

- Contracts: 12/12 passed.
- UI foundation/accessibility: 7/7 passed.
- Desktop: 66/66 passed.
- Contracts, UI, and desktop typechecks passed.
- `git diff --check` exited 0; only Windows line-ending conversion notices were printed.
