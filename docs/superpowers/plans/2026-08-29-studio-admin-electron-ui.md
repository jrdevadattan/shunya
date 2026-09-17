# Studio Admin Electron UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current recovery desktop shell with an Electron-native adaptation of the approved Studio Admin interface while preserving live daemon state, safety policy, and offline behavior.

**Architecture:** Keep Electron, Vite, React Router, the typed preload bridge, and the Rust daemon. Build the Studio Admin visual language as focused components and CSS tokens in `@recovery/ui`, then migrate renderer screens in reviewed slices. Extend the artifact page contract with a daemon-computed total count so the overview shows a truthful indexed-artifact metric.

**Tech Stack:** Electron 44, React 19, React Router 7, TypeScript 5.9, Vite 7, Zod 4, Lucide React, Vitest, Testing Library, Playwright, Rust 1.98, SQLite/FTS result index

**Spec:** `docs/superpowers/specs/2026-08-29-studio-admin-electron-ui-design.md`

## Global Constraints

- Keep the current Electron, Vite, React Router, preload, and Rust daemon architecture.
- Do not add Next.js, a local HTTP server, server actions, cookies, web authentication, telemetry, or online dashboard services.
- The daemon remains the source of case, source, job, artifact, export, report, and capability data.
- Theme and sidebar preferences may use local renderer storage; they must contain no case evidence or operator data.
- Preserve source immutability, destination-topology enforcement, active-job case guards, preview refusal, and typed capability limitations.
- Use the existing Lucide icon dependency. Add a Base UI primitive only for a tested keyboard or focus behavior missing from existing components.
- Match the approved Studio Admin neutral visual target: 272 pixel expanded sidebar, 68 pixel collapsed rail, 48 pixel header, 10 pixel card radius, thin neutral borders, compact controls, and restrained shadows.
- Keep unsupported routes visible and disabled with a keyboard-accessible explanation.
- Support light, dark, and system themes; 200 percent text zoom; visible focus; reduced motion; and WCAG AA contrast.
- Do not add simulated case metrics, recovery results, memory findings, hashes, device identities, or success states.
- Add Studio Admin MIT attribution to `THIRD_PARTY_NOTICES.md` before release.
- No CI/CD.
- macOS and BOSS GNU/Linux 10 remain deferred. Windows x64, Debian Linux x64, and Rescue Mode remain in release scope.

## Execution precondition

The parent completion workflow owns uncommitted platform-validation changes in `Cargo.toml`, `Cargo.lock`, `crates/recovery-daemon/tests/recovery_flow.rs`, `packaging/scripts/stage-tools.ts`, `packaging/scripts/verify-package.ts`, and `tests/platform`. Finish and review that work before Task 1. Do not include those files in any UI task commit.

---

### Task 1: Build the shared Studio Admin visual foundation

**Files:**
- Modify: `packages/ui/src/tokens/colors.css`
- Modify: `packages/ui/src/tokens/components.css`
- Modify: `packages/ui/src/tokens/spacing.css`
- Modify: `packages/ui/src/components/AppShell.tsx`
- Create: `packages/ui/src/components/SurfaceCard.tsx`
- Create: `packages/ui/src/components/MetricCard.tsx`
- Create: `packages/ui/src/components/IconButton.tsx`
- Modify: `packages/ui/src/index.ts`
- Create: `packages/ui/tests/app-shell.test.tsx`
- Modify: `packages/ui/tests/accessibility.test.tsx`

**Interfaces:**
- Consumes: `LucideIcon` from `lucide-react`, React nodes, and ordinary hash URLs.
- Produces: `NavigationGroup`, `NavigationItem`, `AppShell`, `SurfaceCard`, `MetricCard`, and `IconButton` exports for renderer tasks.

- [ ] **Step 1: Write failing component and accessibility tests**

Add tests that render expanded and collapsed shells, grouped navigation, active items, disabled explanations, named icon buttons, metric cards, and a 48 pixel header data contract:

```tsx
const groups: NavigationGroup[] = [{
  id: 'workspace',
  label: 'Workspace',
  items: [
    { id: 'overview', label: 'Overview', href: '#/cases/case-1/overview', icon: LayoutDashboard, active: true },
    { id: 'memory', label: 'Memory Analysis', href: '#/cases/case-1/memory', icon: Cpu, disabledReason: 'Volatility is unavailable.' },
  ],
}];

render(<AppShell brand="SHUNYA Recovery" collapsed={false} onCollapsedChange={() => undefined}
  header={<span>Overview</span>} navigation={groups} footer={<span>Case 1</span>}>
  <p>Case content</p>
</AppShell>);
expect(screen.getByRole('navigation', { name: 'Case navigation' })).toBeVisible();
expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
expect(screen.getByText('Volatility is unavailable.')).toBeVisible();
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `corepack pnpm --filter @recovery/ui test -- app-shell accessibility`

Expected: FAIL because grouped shell props and new components do not exist.

- [ ] **Step 3: Replace tokens with the approved neutral theme contract**

Define exact light/dark variables and layout measurements:

```css
:root {
  color-scheme: light;
  --surface-app: oklch(1 0 0);
  --surface-panel: oklch(1 0 0);
  --surface-muted: oklch(0.97 0 0);
  --text-primary: oklch(0.145 0 0);
  --text-secondary: oklch(0.556 0 0);
  --border-subtle: oklch(0.922 0 0);
  --accent-primary: oklch(0.205 0 0);
  --accent-hover: oklch(0.269 0 0);
  --focus-ring: oklch(0.488 0.243 264.376);
  --sidebar-expanded: 272px;
  --sidebar-collapsed: 68px;
  --app-header-height: 48px;
  --radius-card: 10px;
}

[data-theme='dark'] {
  color-scheme: dark;
  --surface-app: oklch(0.145 0 0);
  --surface-panel: oklch(0.205 0 0);
  --surface-muted: oklch(0.269 0 0);
  --text-primary: oklch(0.985 0 0);
  --text-secondary: oklch(0.708 0 0);
  --border-subtle: oklch(1 0 0 / 10%);
  --accent-primary: oklch(0.922 0 0);
  --accent-hover: oklch(0.87 0 0);
}
```

- [ ] **Step 4: Implement focused shared components**

Use explicit interfaces and semantic elements:

```tsx
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
  disabledReason?: string;
}

export interface NavigationGroup { id: string; label: string; items: NavigationItem[] }

export function MetricCard({ label, value, detail, icon: Icon, tone = 'neutral' }: {
  label: string; value: ReactNode; detail: string; icon: LucideIcon;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  return <article className="metric-card" data-tone={tone}>
    <div className="metric-card__icon" aria-hidden="true"><Icon /></div>
    <p>{label}</p><strong>{value}</strong><span>{detail}</span>
  </article>;
}
```

`AppShell` must render brand/sidebar, grouped navigation, a 48 pixel header, content, footer, and a collapse button whose accessible name changes between `Collapse sidebar` and `Expand sidebar`. Disabled items render a button with `aria-disabled="true"` plus visible `disabledReason`, not a working link.

- [ ] **Step 5: Run UI tests, typecheck, and accessibility checks**

Run:

```powershell
corepack pnpm --filter @recovery/ui test
corepack pnpm --filter @recovery/ui typecheck
```

Expected: all UI tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit Task 1**

```powershell
git add packages/ui/src packages/ui/tests
git commit -m "feat(ui): add Studio Admin visual foundation"
```

### Task 2: Add renderer preferences, case navigation, and command search

**Files:**
- Create: `apps/desktop/src/renderer/features/preferences/ui-preferences.ts`
- Create: `apps/desktop/src/renderer/components/CommandPalette.tsx`
- Create: `apps/desktop/src/renderer/routes/case-navigation.ts`
- Modify: `apps/desktop/src/renderer/routes/CaseLayout.tsx`
- Modify: `apps/desktop/src/renderer/styles/app.css`
- Modify: `apps/desktop/tests/integration/live-renderer.test.tsx`
- Create: `apps/desktop/tests/integration/ui-preferences.test.ts`

**Interfaces:**
- Consumes: Task 1 `AppShell`, `NavigationGroup`, `IconButton`, `RuntimeModeBadge`.
- Produces: `UiPreferences`, `loadUiPreferences`, `saveUiPreferences`, `applyTheme`, `caseNavigation(caseId, pathname)`, and `CommandPalette`.

- [ ] **Step 1: Write failing preference, navigation, and command tests**

Test malformed storage fallback, system-theme resolution, collapsed persistence, active navigation, `Ctrl+K`/`Meta+K`, Escape close, and focus restoration:

```ts
localStorage.setItem('recovery:ui-preferences', '{bad json');
expect(loadUiPreferences()).toEqual({ theme: 'system', sidebarCollapsed: false });

saveUiPreferences({ theme: 'dark', sidebarCollapsed: true });
expect(JSON.parse(localStorage.getItem('recovery:ui-preferences')!)).toEqual({
  theme: 'dark', sidebarCollapsed: true,
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `corepack pnpm --filter @recovery/desktop test -- ui-preferences live-renderer`

Expected: FAIL because the preference module, navigation groups, and command palette are missing.

- [ ] **Step 3: Implement strict local preference parsing**

```ts
export type ThemePreference = 'light' | 'dark' | 'system';
export interface UiPreferences { theme: ThemePreference; sidebarCollapsed: boolean }
const defaults: UiPreferences = { theme: 'system', sidebarCollapsed: false };

export function loadUiPreferences(storage: Storage = localStorage): UiPreferences {
  try {
    const value: unknown = JSON.parse(storage.getItem('recovery:ui-preferences') ?? 'null');
    if (!value || typeof value !== 'object') return defaults;
    const record = value as Record<string, unknown>;
    if (!['light', 'dark', 'system'].includes(String(record.theme)) || typeof record.sidebarCollapsed !== 'boolean') return defaults;
    return { theme: record.theme as ThemePreference, sidebarCollapsed: record.sidebarCollapsed };
  } catch { return defaults; }
}
```

`applyTheme` sets `document.documentElement.dataset.theme` to `light` or `dark` and listens to `matchMedia('(prefers-color-scheme: dark)')` only while the preference equals `system`.

- [ ] **Step 4: Implement grouped recovery navigation and command search**

`caseNavigation` returns the exact Workspace, Analysis, and Output groups from the spec with Lucide icons. The command palette uses the same items, filters by label, navigates through `useNavigate`, traps focus while open, closes on Escape, and restores focus to the trigger.

- [ ] **Step 5: Integrate the Studio shell in `CaseLayout`**

Keep case/runtime schema parsing and active case guards. Add theme, collapse, current route, page title, command search, runtime badge, and case footer. Do not move case data into local storage.

```tsx
const groups = caseNavigation(caseId, location.pathname);
return <AppShell brand="SHUNYA Recovery" navigation={groups}
  collapsed={preferences.sidebarCollapsed}
  onCollapsedChange={(sidebarCollapsed) => updatePreferences({ ...preferences, sidebarCollapsed })}
  header={<CaseHeader title={activeTitle(groups)} runtimeMode={runtimeMode} onOpenSearch={() => setSearchOpen(true)} />}
  footer={<CaseIdentity title={recoveryCase?.title ?? 'Recovery case'} caseId={caseId} />}>
  {recoveryCase?.caseId === caseId ? <Outlet /> : <CaseOpeningState error={error} />}
</AppShell>;
```

- [ ] **Step 6: Run renderer tests and typecheck**

Run:

```powershell
corepack pnpm --filter @recovery/desktop test -- ui-preferences live-renderer
corepack pnpm --filter @recovery/desktop typecheck
```

Expected: focused tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit Task 2**

```powershell
git add apps/desktop/src/renderer/components apps/desktop/src/renderer/features/preferences apps/desktop/src/renderer/routes apps/desktop/src/renderer/styles/app.css apps/desktop/tests/integration
git commit -m "feat(desktop): add Studio recovery workspace shell"
```

### Task 3: Add truthful overview metrics and redesign case entry

**Files:**
- Modify: `packages/contracts/src/desktop.ts`
- Modify: `crates/recovery-daemon/src/router.rs`
- Modify: `crates/recovery-daemon/tests/recovery_flow.rs`
- Modify: `apps/desktop/tests/integration/daemon-supervisor.test.ts`
- Modify: `apps/desktop/tests/integration/live-renderer.test.tsx`
- Modify: `apps/desktop/tests/performance/million-results.spec.ts`
- Modify: `apps/desktop/src/renderer/features/results/result-store.ts`
- Modify: `apps/desktop/src/renderer/features/results/ResultsPage.tsx`
- Modify: `apps/desktop/src/renderer/features/export/ExportWizard.tsx`
- Create: `apps/desktop/src/renderer/routes/CaseOverviewPage.tsx`
- Modify: `apps/desktop/src/renderer/routes/WelcomePage.tsx`
- Modify: `apps/desktop/src/renderer/routes/NewCasePage.tsx`
- Modify: `apps/desktop/src/renderer/routes/router.tsx`
- Modify: `apps/desktop/src/renderer/styles/app.css`

**Interfaces:**
- Consumes: current `artifact.query`, `ArtifactIndex::count`, Task 1 `MetricCard`/`SurfaceCard`, and Task 2 shell styles.
- Produces: `ArtifactPage.totalCount: number`, live `CaseOverviewPage`, and Studio-styled welcome/case forms.

- [ ] **Step 1: Write failing contract and daemon count tests**

Extend expectations so every artifact page returns the total number matching the filter, independent of cursor size:

```ts
expect(ArtifactPageSchema.parse({ items: [], nextCursor: null, totalCount: 501 }).totalCount).toBe(501);
```

```rust
let page = daemon.rpc("artifact.query", json!({ "pageSize": 1 }));
assert_eq!(page["items"].as_array().unwrap().len(), 1);
assert_eq!(page["totalCount"], json!(2));
```

- [ ] **Step 2: Run focused contract/Rust tests and verify RED**

Run:

```powershell
corepack pnpm --filter @recovery/contracts test
cargo nextest run -p recovery-daemon --test recovery_flow
```

Expected: FAIL because `totalCount` is absent.

- [ ] **Step 3: Add daemon-computed `totalCount`**

Change the contract to:

```ts
export const ArtifactPageSchema = z.object({
  items: z.array(RecoveryArtifactSchema),
  nextCursor: z.string().nullable(),
  totalCount: z.number().int().nonnegative(),
});
```

In `query_artifacts`, use the same parsed `ArtifactQuery` for `index.query(&query)` and `index.count(&query)`, then return:

```rust
Ok(json!({
    "items": items,
    "nextCursor": page.next_cursor,
    "totalCount": total_count,
}))
```

Update the initial page values in `result-store.ts` and `ResultsPage.tsx`, the export page traversal, the million-result test, and every `ArtifactPage` test double to include `totalCount`.

- [ ] **Step 4: Write failing live Overview tests**

Mock `listSources`, `getJobStatus`, and `queryArtifacts` with parsed live values. Assert Overview renders `2` sources, the persisted job stage, `501` indexed artifacts, and a limitation count. Assert rejected calls render an alert and never render invented values.

- [ ] **Step 5: Implement `CaseOverviewPage` from live APIs**

Load sources and `{ pageSize: 1 }` artifacts. Read the active job ID from the current application state; request status only when it exists. Derive limitation count from the job response. Abort state updates after unmount.

```tsx
<div className="metric-grid metric-grid--overview">
  <MetricCard label="Sources" value={sources.length} detail="Evidence sources in this case" icon={HardDrive} />
  <MetricCard label="Recovery job" value={job ? stageLabel(job.stage) : 'Not started'} detail={job ? 'Persisted daemon state' : 'Add a source to begin'} icon={Activity} />
  <MetricCard label="Recovered artifacts" value={artifacts.totalCount} detail="Indexed by the recovery daemon" icon={Files} />
  <MetricCard label="Limitations" value={job?.limitations.length ?? 0} detail="Capabilities requiring attention" icon={TriangleAlert} tone={job?.limitations.length ? 'warning' : 'neutral'} />
</div>
```

- [ ] **Step 6: Redesign Welcome and case forms without fake recent cases**

Use Studio cards and buttons for Create Case, Open Case, Disk Image, and Memory Image. Do not display recent cases because no daemon recent-case API exists. Keep the Installed Mode notice and all form validation.

- [ ] **Step 7: Run Task 3 verification**

Run:

```powershell
corepack pnpm --filter @recovery/contracts test
corepack pnpm --filter @recovery/desktop test -- daemon-supervisor live-renderer
cargo nextest run -p recovery-daemon --test recovery_flow
corepack pnpm --filter @recovery/desktop typecheck
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit Task 3**

```powershell
git add packages/contracts/src/desktop.ts crates/recovery-daemon/src/router.rs crates/recovery-daemon/tests/recovery_flow.rs apps/desktop/src/renderer/routes apps/desktop/src/renderer/styles/app.css apps/desktop/tests/integration
git commit -m "feat(desktop): add live recovery case overview"
```

### Task 4: Standardize source and recovery workflow screens

**Files:**
- Create: `apps/desktop/src/renderer/components/WorkflowFrame.tsx`
- Modify: `apps/desktop/src/renderer/features/sources/AddSourcePage.tsx`
- Modify: `apps/desktop/src/renderer/features/sources/SourceAssessmentPage.tsx`
- Modify: `apps/desktop/src/renderer/features/sources/SourceCard.tsx`
- Modify: `apps/desktop/src/renderer/features/sources/AssessmentFinding.tsx`
- Modify: `apps/desktop/src/renderer/features/sources/PartitionList.tsx`
- Modify: `apps/desktop/src/renderer/features/recovery/DestinationPage.tsx`
- Modify: `apps/desktop/src/renderer/features/recovery/AcquisitionOptions.tsx`
- Modify: `apps/desktop/src/renderer/features/recovery/DamagedDeviceWizard.tsx`
- Modify: `apps/desktop/src/renderer/features/recovery/GoalPage.tsx`
- Modify: `apps/desktop/src/renderer/features/recovery/ScanOptionsPage.tsx`
- Modify: `apps/desktop/src/renderer/features/recovery/FileFamilySelector.tsx`
- Modify: `apps/desktop/src/renderer/styles/app.css`
- Modify: `apps/desktop/tests/integration/live-renderer.test.tsx`
- Modify: `apps/desktop/tests/e2e/add-image-source.spec.ts`
- Modify: `apps/desktop/tests/e2e/partition-scan.spec.ts`
- Modify: `apps/desktop/tests/e2e/safety-blocks.spec.ts`

**Interfaces:**
- Consumes: shared cards/banners/buttons and existing source/recovery APIs.
- Produces: `WorkflowFrame` with typed steps and consistent source/recovery layout.

- [ ] **Step 1: Write failing WorkflowFrame and live workflow assertions**

Define the interface in the test:

```tsx
<WorkflowFrame eyebrow="Source" title="Assess evidence" description="Review safety findings."
  steps={[{ id: 'source', label: 'Source', state: 'complete' }, { id: 'assessment', label: 'Assessment', state: 'current' }]}
  aside={<CapabilityBanner level="warning" title="Mounted source" explanation="Use a read-only image." />}>
  <p>Assessment content</p>
</WorkflowFrame>
```

Assert the ordered step list exposes `aria-current="step"`, complete state text, heading association, and the warning.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `corepack pnpm --filter @recovery/desktop test -- live-renderer`

Expected: FAIL because `WorkflowFrame` does not exist.

- [ ] **Step 3: Implement `WorkflowFrame`**

```ts
export interface WorkflowStep {
  id: string;
  label: string;
  state: 'upcoming' | 'current' | 'complete';
}
```

Render a page header, semantic ordered step list, primary surface card, optional safety aside, and action footer slot. Use CSS only for layout; keep business state in existing feature components.

- [ ] **Step 4: Migrate source and recovery components**

Wrap each existing flow in `WorkflowFrame`. Preserve all event handlers, parsed API results, form labels, error roles, disabled explanations, and route destinations. Use Lucide icons in selection cards. Do not add controls for unavailable acquisition, ddrescue, file-family, or destination-assessment operations.

- [ ] **Step 5: Run integration and packaged workflow E2E**

Run:

```powershell
corepack pnpm --filter @recovery/desktop test -- live-renderer
corepack pnpm --filter @recovery/desktop test:e2e -- --grep "add image source|partition scan|safety"
corepack pnpm --filter @recovery/desktop typecheck
```

Expected: focused integration and E2E tests pass.

- [ ] **Step 6: Commit Task 4**

```powershell
git add apps/desktop/src/renderer/components/WorkflowFrame.tsx apps/desktop/src/renderer/features/sources apps/desktop/src/renderer/features/recovery apps/desktop/src/renderer/styles/app.css apps/desktop/tests
git commit -m "feat(desktop): restyle recovery workflows"
```

### Task 5: Redesign live job monitoring

**Files:**
- Modify: `apps/desktop/src/renderer/features/jobs/JobProgressPage.tsx`
- Modify: `apps/desktop/src/renderer/features/jobs/ReadErrorMap.tsx`
- Modify: `apps/desktop/src/renderer/styles/app.css`
- Modify: `apps/desktop/tests/integration/live-renderer.test.tsx`
- Modify: `apps/desktop/tests/e2e/active-job-reload.spec.ts`
- Modify: `apps/desktop/tests/e2e/job-resume.spec.ts`

**Interfaces:**
- Consumes: existing daemon job polling/command logic, `MetricCard`, `SurfaceCard`, `StageTimeline`, and `CapabilityBanner`.
- Produces: Studio-style job summary, timeline, event stream, and persistent command errors with unchanged control semantics.

- [ ] **Step 1: Extend failing job UI tests**

Assert the running screen contains a named progress region, semantic stage timeline, limitation banner, event log, and correct control set. Keep the existing no-overlap, terminal-stop, stale-poll, and persistent-command-error assertions.

- [ ] **Step 2: Run focused job tests and verify RED**

Run: `corepack pnpm --filter @recovery/desktop test -- live-renderer job-store`

Expected: new structural assertions fail against the current layout.

- [ ] **Step 3: Recompose `JobProgressPage` without changing polling**

Keep `requestGeneration`, `inFlight`, cursor sequence, terminal stage handling, and `command` intact. Render the state through the shared components:

```tsx
<SurfaceCard className="job-progress__summary">
  <div role="progressbar" aria-label="Recovery progress" aria-valuemin={0} aria-valuemax={100}
    aria-valuenow={stageProgress(status.stage)}>
    <span style={{ width: `${stageProgress(status.stage)}%` }} />
  </div>
  <StageTimeline stages={timelineStages(status.stage)} />
</SurfaceCard>
```

`stageProgress` uses this fixed ordered stage map and labels its estimate as stage progress, not bytes recovered. Paused and attention states retain the last completed stage position stored in the latest event:

```ts
const stagePercent: Partial<Record<JobStatus['stage'], number>> = {
  draft: 0,
  preflight: 5,
  acquiring: 15,
  verifying_image: 25,
  partition_scan: 35,
  metadata_scan: 50,
  carving: 65,
  validating: 78,
  threat_scan: 86,
  indexing: 94,
  review_ready: 98,
  completed: 100,
  cancelled: 100,
  failed: 100,
};
```

- [ ] **Step 4: Restyle event log and read-error map**

Use a bounded scroll region with an ordered list and visible timestamps/stages. Keep read-error map colors paired with text labels so color is not the only signal.

- [ ] **Step 5: Run job verification**

Run:

```powershell
corepack pnpm --filter @recovery/desktop test -- live-renderer job-store
corepack pnpm --filter @recovery/desktop test:e2e -- --grep "resume after restart|active job reload"
```

Expected: focused tests and packaged controls pass.

- [ ] **Step 6: Commit Task 5**

```powershell
git add apps/desktop/src/renderer/features/jobs apps/desktop/src/renderer/styles/app.css apps/desktop/tests
git commit -m "feat(desktop): redesign recovery job monitoring"
```

### Task 6: Redesign results and output workspaces

**Files:**
- Modify: `apps/desktop/src/renderer/features/results/ResultsPage.tsx`
- Modify: `apps/desktop/src/renderer/features/results/ResultFilters.tsx`
- Modify: `apps/desktop/src/renderer/features/results/ArtifactTable.tsx`
- Modify: `apps/desktop/src/renderer/features/results/ArtifactDetailsPanel.tsx`
- Modify: `apps/desktop/src/renderer/features/results/PreviewPanel.tsx`
- Modify: `apps/desktop/src/renderer/features/memory/MemorySourcePage.tsx`
- Modify: `apps/desktop/src/renderer/features/memory/MemoryOptionsPage.tsx`
- Modify: `apps/desktop/src/renderer/features/memory/MemoryResultsPage.tsx`
- Modify: `apps/desktop/src/renderer/features/export/ExportWizard.tsx`
- Modify: `apps/desktop/src/renderer/features/reports/ReportsPage.tsx`
- Modify: `apps/desktop/src/renderer/styles/app.css`
- Modify: `apps/desktop/tests/integration/live-renderer.test.tsx`
- Modify: `apps/desktop/tests/e2e/results-workspace.spec.ts`
- Modify: `apps/desktop/tests/e2e/unsafe-preview.spec.ts`
- Modify: `apps/desktop/tests/e2e/export-report.spec.ts`
- Modify: `apps/desktop/tests/e2e/memory-analysis.spec.ts`

**Interfaces:**
- Consumes: Task 3 `ArtifactPage.totalCount`, existing query-generation/cursor locks, preview policy, export/report APIs, and shared visual components.
- Produces: Studio file-manager layout and consistent output/limitation screens.

- [ ] **Step 1: Write failing responsive and semantic tests**

Assert Results shows `totalCount`, search toolbar, semantic table headers/cells, filter rail, details region, cursor loading state, and preview refusal. At compact width, assert CSS layout markers stack filter/details without removing policy text.

- [ ] **Step 2: Run focused result/output tests and verify RED**

Run: `corepack pnpm --filter @recovery/desktop test -- live-renderer million-results`

Expected: new Studio layout and `totalCount` assertions fail.

- [ ] **Step 3: Recompose Results while preserving concurrency guards**

Keep `generation`, `appendToken`, `appendInFlight`, selection reset, and preview generation behavior. Add the total label and Studio layout:

```tsx
<header className="page-toolbar">
  <div><p className="eyebrow">Recovered files</p><h1>Recovered files</h1>
    <p>{page.totalCount.toLocaleString()} indexed artifacts</p></div>
  <ResultFilters search={search} onSearch={setSearch} />
</header>
<div className="file-workspace">
  <aside className="file-workspace__filters">...</aside>
  <section className="file-workspace__table" aria-label="Recovered artifact table">...</section>
  <aside className="file-workspace__details" aria-label="Artifact details">...</aside>
</div>
```

- [ ] **Step 4: Normalize memory, export, and report screens**

Use the same page toolbar, surface cards, badges, data lists, empty states, and persistent alerts. Keep Volatility unavailability, complete export cursor traversal, mixed-verification refusal, daemon-derived topology, report paths, and limitations unchanged.

- [ ] **Step 5: Run result/output integration and E2E**

Run:

```powershell
corepack pnpm --filter @recovery/desktop test -- live-renderer million-results preview-policy
corepack pnpm --filter @recovery/desktop test:e2e -- --grep "results workspace|unsafe preview|export and report|memory analysis"
corepack pnpm --filter @recovery/desktop typecheck
```

Expected: focused tests pass.

- [ ] **Step 6: Commit Task 6**

```powershell
git add apps/desktop/src/renderer/features apps/desktop/src/renderer/styles/app.css apps/desktop/tests
git commit -m "feat(desktop): redesign recovery result workspaces"
```

### Task 7: Verify visual fidelity, accessibility, packages, and attribution

**Files:**
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `docs/operations/recovery-limitations.md`
- Modify: `docs/operations/manual-release.md`
- Modify: `apps/desktop/tests/e2e/navigation.spec.ts`
- Modify: `apps/desktop/tests/e2e/ui-responsiveness.spec.ts`
- Create: `docs/validation/studio-admin-ui-validation.md`

**Interfaces:**
- Consumes: all prior UI tasks, approved Studio Admin screenshot, packaged Windows app, Debian package workflow.
- Produces: verified UI evidence, reference attribution, and accurate release limitations.

- [ ] **Step 1: Add failing packaged shell acceptance assertions**

At a 1280 by 800 viewport assert the expanded sidebar width equals 272 pixels and header height equals 48 pixels. Toggle the sidebar and assert 68 pixels. Switch light/dark/system themes, reload, and assert the stored preference and resolved root theme. At 200 percent text zoom assert the shell has no document-level horizontal overflow and Results retains its policy text.

- [ ] **Step 2: Run packaged UI tests and verify RED where acceptance is missing**

Run:

```powershell
corepack pnpm --filter @recovery/desktop test:e2e -- --grep "navigation|responsive"
```

Expected: new exact shell and preference assertions fail until selectors and final layout details are complete.

- [ ] **Step 3: Fix final visible mismatches against the reference**

Capture the Studio Admin reference and the packaged Electron Overview at 1280 by 800. Place both images side by side for inspection. Check sidebar width, header height, card radius, border color, spacing, typography weight, icon size, table density, and focus rings. Adjust only token and layout CSS needed to match the approved target.

- [ ] **Step 4: Add attribution and scope documentation**

Append:

```markdown
### Studio Admin visual reference

The desktop interface adapts layout and visual patterns from Studio Admin by Arham Khan.
Source: https://github.com/arhamkhnz/next-shadcn-admin-dashboard-baseui
License: MIT
```

State that macOS and BOSS GNU/Linux 10 validation are deferred. State Windows signing status and Debian/Rescue evidence exactly as verified.

- [ ] **Step 5: Run the full fresh verification matrix**

Run on Windows with Cargo on PATH:

```powershell
$env:PATH="$env:USERPROFILE\.cargo\bin;$env:PATH"
cargo fmt --all -- --check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
cargo nextest run --workspace --no-tests pass
cargo test -p result-index --test million_rows -- --nocapture
corepack pnpm test:e2e
$env:RECOVERY_RELEASE_BUILD='1'
corepack pnpm --filter @recovery/desktop make
Push-Location apps/desktop
corepack pnpm exec tsx ../../packaging/scripts/verify-package.ts 'out/SIH Recovery Platform-win32-x64'
Pop-Location
```

Run standard Debian/Rescue validation in WSL using the documented package scripts. Do not claim BOSS or macOS validation.

- [ ] **Step 6: Launch the packaged Windows app and capture evidence**

Start `apps/desktop/out/SIH Recovery Platform-win32-x64/recovery-platform.exe` with `Start-Process -WindowStyle Hidden` omitted because the user requested the visible app. Confirm the process path matches the fresh package and leave the window open.

- [ ] **Step 7: Write the validation record**

Record commit SHA, commands, pass counts, package paths and hashes, screenshot paths, Windows launch process path, Debian/Rescue results, and explicit macOS/BOSS deferrals in `docs/validation/studio-admin-ui-validation.md`.

- [ ] **Step 8: Commit Task 7**

```powershell
git add THIRD_PARTY_NOTICES.md docs/operations docs/validation apps/desktop/tests/e2e
git commit -m "docs: verify Studio recovery desktop release"
```

## Completion gate

Request a broad whole-branch review against the spec after Task 7. Fix all Critical and Important findings, rerun the full verification matrix, then return to the parent recovery-platform completion workflow for release assembly, push to `dev`, and publication of the non-mac release.
