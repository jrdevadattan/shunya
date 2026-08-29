# Studio Admin UI Adaptation for SIH Recovery Platform

Date: 2026-08-29

## Decision

Adapt the visual system and dashboard shell from [Studio Admin](https://github.com/arhamkhnz/next-shadcn-admin-dashboard-baseui) to the existing Electron renderer. Keep the current Electron, Vite, React Router, preload, and Rust daemon architecture.

The adaptation uses Studio Admin's neutral theme, compact header, collapsible sidebar, cards, tables, spacing, typography, and icon treatment. The app keeps recovery-specific screens, data, safety policy, and offline behavior.

Studio Admin uses the MIT license. Add its attribution to `THIRD_PARTY_NOTICES.md` before release.

## Goals

- Give the Windows and Linux desktop app the same visual character as the approved Studio Admin reference.
- Preserve the typed preload API and make the daemon the source of case, source, job, artifact, export, report, and capability data.
- Keep unsupported capabilities visible with actionable explanations.
- Support keyboard navigation, 200 percent text zoom, light and dark themes, and a collapsed sidebar.
- Retain packaged Electron E2E coverage for recovery workflows.

## Architecture

Build an Electron-native shell in the existing renderer. React Router continues to own navigation. The preload bridge continues to validate daemon responses with the shared contract schemas.

Do not add Next.js, a local HTTP server, server actions, cookies, web authentication, telemetry, or online dashboard services. Do not copy Studio Admin's CRM, finance, customer, account, or social features.

Use the existing Lucide icon dependency. Implement the reference's neutral shadcn-style tokens as CSS custom properties in the current UI package and renderer stylesheet. Add a Base UI primitive only when it provides a tested keyboard or focus behavior that the existing components lack.

## Application shell

### Sidebar

The expanded sidebar uses a 272 pixel width. The collapsed state uses a 68 pixel icon rail. The user can toggle the state from the header, and the renderer stores the preference on the local machine.

The case workspace contains these navigation groups:

| Group | Items |
| --- | --- |
| Workspace | Overview, Sources, Recovery Jobs, Recovered Files |
| Analysis | Memory Analysis |
| Output | Exports, Reports, Case Activity |

The top of the sidebar shows the product name and recovery mark. The primary action starts the Add Source flow. The footer shows the current case title and case identifier. It does not show a user account or contact card.

The active item uses the reference's muted neutral background and stronger foreground. Unsupported routes remain visible and disabled with a reason available through text and keyboard focus.

### Header

The 48 pixel header contains the sidebar toggle, current screen title, command search, runtime-mode badge, theme control, and case menu.

Command search navigates to available screens and actions. It does not search artifact contents. Recovered-file search remains on the Results screen and uses the daemon's paged query API.

The runtime-mode badge stays visible in Installed and Rescue modes. The theme control supports light, dark, and system modes. The case menu exposes safe case-level actions and never bypasses an active job guard.

### Content frame

The content area uses 16 pixel padding at compact widths and 24 pixel padding above the desktop breakpoint. It supports an optional centered maximum width for forms and full-width layouts for Results and event streams.

Cards use the reference's thin neutral border, 10 pixel radius, white or dark-neutral surface, and restrained shadow. Status colors communicate meaning: green for verified success, amber for limitations, red for blocked or failed operations, and neutral gray for inactive state.

## Screen mapping

### Welcome and case selection

The Welcome screen sits outside the case sidebar. It uses the same header, typography, buttons, and card language. It provides Create Case and Open Case actions plus recent cases when the daemon exposes them. An empty recent-case list shows a useful empty state rather than sample data.

### Case overview

The Overview screen reads live case state and presents four metric cards:

- Sources added
- Active or paused recovery jobs
- Indexed recovered artifacts
- Current limitations requiring attention

The screen also shows recent case activity and the next safe action. Each value comes from the daemon. A missing capability produces a limitation card instead of a fabricated zero or success state.

### Sources and recovery setup

Source selection, assessment, goal selection, scan options, partition review, acquisition, and damaged-media screens use a shared workflow frame. The frame contains a compact heading, step indicator, content card, safety summary, and back/continue actions.

The app keeps all existing write-protection and destination-topology checks. Disabled actions include a visible reason. The app does not make unavailable acquisition or ddrescue workflows look interactive.

### Recovery jobs

The Jobs screen combines a summary card, stage timeline, progress bar, event stream, and pause/resume/cancel controls. Terminal jobs stop polling. Command errors remain visible until the user dismisses them or retries.

### Recovered files

The Results screen adapts Studio Admin's file-manager and data-table patterns. It keeps daemon-side search, filters, cursor pagination, artifact selection, safe preview, and details. The layout uses a filter rail, main table, and details panel at wide widths. Narrow widths stack the filter and details regions without hiding policy messages.

The table keeps semantic table roles, keyboard row selection, visible focus, loading placeholders, empty states, and a stable selection reset when the query changes.

### Memory, exports, reports, and activity

These screens use the same toolbar, card, table, badge, and empty-state components. Volatility, export topology, preview, and report limitations remain truthful. The UI does not generate memory findings, hashes, device identity, or recovery counts.

## State and data flow

The shell reads case identity and route state from React Router. Feature stores continue to own source, job, result, export, and report state. Components receive parsed contract values and render loading, success, empty, limitation, or error states.

Theme and sidebar preferences stay in local renderer storage. They contain no case evidence or operator data. Case state stays behind the preload API and daemon.

The Overview screen composes existing daemon-backed feature state. If the daemon needs a small aggregate endpoint to avoid expensive client queries, add a typed contract and integration test before using it.

## Error and safety behavior

- Show daemon connection and schema failures as persistent banners with a plain-language message and technical code.
- Keep unsupported capabilities visible. Disable their primary action and show the required environment or tool.
- Preserve active-job case-switch guards.
- Preserve source immutability and daemon-derived destination topology checks.
- Refuse unsafe preview types unless a verified derivative exists.
- Keep loading placeholders visually distinct from zero, empty, and unavailable states.

## Accessibility

- Provide a keyboard path to the sidebar toggle, navigation, command search, page actions, tables, and dialogs.
- Restore focus when drawers, menus, and dialogs close.
- Provide accessible names for icon-only buttons.
- Support 200 percent text zoom without horizontal page clipping. Results may scroll inside the table region.
- Meet WCAG AA contrast for text, focus rings, badges, and disabled explanations.
- Respect reduced-motion preferences.

## Testing and visual verification

1. Add component tests for sidebar states, navigation groups, runtime badge, theme preference, command search, limitation banners, and responsive stacking.
2. Update renderer integration tests without weakening daemon-response and case-isolation assertions.
3. Update packaged Electron E2E selectors to accessible names and verify create/open case, add source, active job controls, results, export, report, and restart flows.
4. Capture the approved Studio Admin reference and the Electron implementation at the same desktop viewport. Compare sidebar width, header height, card radius, borders, spacing, typography, and table density. Fix visible mismatches and repeat the comparison.
5. Run typecheck, lint, unit tests, Rust tests, packaged Electron E2E, million-row performance, package verification, and Windows/Linux package builds.
6. Launch the packaged Windows executable and leave it open for user inspection.

## Release scope

Windows x64, standard Debian Linux x64, and Rescue Mode remain in the current completion scope. The user deferred macOS and BOSS GNU/Linux 10 validation. Release notes must state those exclusions and must not claim signed Windows, signed/notarized macOS, or BOSS compatibility without matching native evidence.

## Non-goals

- Porting the reference project's web dashboards or sample business data
- Adding authentication, accounts, multi-tenancy, cloud sync, or telemetry
- Replacing the daemon with renderer-managed case data
- Adding CI/CD
- Producing macOS or BOSS artifacts in this release pass

## Acceptance criteria

- The packaged Electron app visibly matches the approved Studio Admin shell while retaining SIH recovery branding and workflows.
- Every displayed forensic value comes from the daemon or a labeled local preference.
- Existing recovery integration and packaged E2E tests pass after the redesign.
- Keyboard navigation, themes, collapsed sidebar, 200 percent zoom, and responsive Results layout have automated coverage.
- Windows and Debian packages pass content verification, and the packaged Windows app opens successfully.
- Documentation credits the MIT reference and states the macOS and BOSS deferrals.
