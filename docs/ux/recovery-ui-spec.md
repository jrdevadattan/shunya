# Recovery Module UI and Interaction Specification

## 1. Design direction

The interface should feel like a modern government evidence workstation: calm, structured, trustworthy, and easy to audit. It must not look like a neon cybersecurity dashboard, a consumer “one-click miracle” recovery tool, or a command-line wrapper.

Use three inspiration patterns:

1. **Case-first workflow:** create/open a case before analysis.
2. **Background processing with visible stages:** users can see what the system is doing and continue reviewing completed results.
3. **Three-pane evidence review:** filters/tree on the left, results in the center, preview/provenance on the right.

Do not copy branding or exact layouts from commercial products.

### Research basis

- Autopsy uses a case-oriented investigation flow and separates navigation, result lists, and content/detail viewing. Adopt that information architecture, then simplify the terminology for guided operators.
- Magnet AXIOM emphasizes adding evidence sources, processing in the background, and reviewing centralized evidence. Adopt the clear source-to-processing-to-review progression, not its proprietary appearance.
- Mature disk-recovery interfaces commonly show a device/partition tree and file result table. Keep that discoverability, but hide raw paths, sectors, and filesystem IDs until the user opens Advanced Details.
- Use WCAG 2.2 focus, status-message, contrast, keyboard, and target-size practices for the Electron interface.

## 2. Visual tokens

### 2.1 Color roles

Use semantic tokens rather than hard-coded component colors.

- `surface-app`: neutral near-white / near-black in dark mode.
- `surface-panel`: slightly elevated neutral.
- `text-primary`: highest contrast.
- `text-secondary`: explanatory copy.
- `accent-primary`: restrained blue for primary actions and selected states.
- `status-success`: green with check icon and text.
- `status-warning`: amber with warning icon and text.
- `status-danger`: red with stop icon and text.
- `status-info`: blue with information icon and text.
- `status-neutral`: gray with text.

Never encode status only by color.

### 2.2 Typography

System UI stack:

```css
font-family: Inter, "Noto Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

Do not require a downloaded web font. Use:

- 28/36 semibold for page titles.
- 20/28 semibold for section titles.
- 16/24 medium for card titles.
- 14/20 regular for normal content.
- 12/16 medium for metadata labels.
- Monospace only for hashes, offsets, IDs, and logs.

### 2.3 Layout

- Primary design size: 1440 × 900.
- Minimum supported: 1280 × 720.
- Left app navigation: 232 px.
- Results filters: 260 px, collapsible.
- Details panel: 360–440 px, resizable.
- Main content uses 24 px outer padding and 16 px component gaps.
- No page should require horizontal scrolling except the hex viewer.

### 2.4 Components

Required reusable components:

- `AppShell`
- `RuntimeModeBadge`
- `CaseHeader`
- `StepIndicator`
- `SourceCard`
- `CapabilityBanner`
- `PlainLanguageNotice`
- `InfoPopover`
- `AdvancedDetailsDrawer`
- `StageTimeline`
- `ProgressMetric`
- `ResultStatusBadge`
- `RecoveryMethodBadge`
- `ThreatBadge`
- `ArtifactTable`
- `PreviewPanel`
- `EmptyState`
- `BlockingDialog`
- `ConfirmationDialog`
- `ToastRegion`
- `EvidenceLogDrawer`

## 3. Global navigation

Left navigation after a case is open:

1. Overview
2. Sources
3. Recovery Jobs
4. Recovered Files
5. Memory Analysis
6. Exports
7. Reports
8. Case Activity

Bottom items:

- Help
- Settings
- About and Tool Versions

Top bar:

- Current case title and ID.
- `Installed Mode` or `Rescue Mode` badge.
- Background-job indicator.
- Operator menu.

## 4. Route map

```text
/
/cases/new
/cases/open
/cases/:caseId/overview
/cases/:caseId/sources
/cases/:caseId/sources/add
/cases/:caseId/sources/:sourceId/assessment
/cases/:caseId/recovery/new
/cases/:caseId/recovery/new/goal
/cases/:caseId/recovery/new/options
/cases/:caseId/recovery/new/destination
/cases/:caseId/recovery/new/review
/cases/:caseId/jobs/:jobId
/cases/:caseId/results
/cases/:caseId/results/:artifactId
/cases/:caseId/export
/cases/:caseId/reports
/cases/:caseId/memory/new
/settings
/help
```

## 5. Screen 1 — Welcome

### Content

Title: **Recover data safely and preserve the source**

Subtitle:

> Create a case, select a device or image, and recover files without writing to the source.

Primary cards:

- **New recovery case**
  - “Start a new investigation or recovery operation.”
- **Open existing case**
  - “Continue a scan, review recovered files, or export results.”
- **Analyze disk image**
  - “Quickly create a case from an existing RAW or E01 image.”
- **Analyze memory image**
  - “Inspect a supported RAM image using a separate workflow.”

Runtime banner:

Installed Mode:

> You are using Installed Mode. For the current system disk, a failing device, or a potentially compromised computer, Rescue Mode provides a safer recovery environment.

Rescue Mode:

> You are using Rescue Mode. Storage is not mounted automatically, and selected sources are opened read-only.

### Click behavior

| Control | Action | Validation/result |
|---|---|---|
| New recovery case | `/cases/new` | None |
| Open existing case | Native directory picker | Accept only a valid case root; show reason if invalid |
| Analyze disk image | Create minimal case then image picker | Do not open an image directly in renderer |
| Analyze memory image | Create minimal case then memory flow | Separate result domain |
| Learn about Rescue Mode | Help side sheet | Explain when and how, no destructive content |

## 6. Screen 2 — Create case

Fields:

- Case title, required.
- Reference number, optional.
- Operator name/ID, required.
- Organization/unit, optional.
- Case workspace destination, required.
- Notes, optional.

Primary button: **Create case**

Secondary: **Cancel**

Plain-language hint below workspace:

> Choose a destination with enough free space for the disk image and recovered files. The source device cannot be used as the destination.

Validation:

- Case title 3–120 characters.
- Workspace writable.
- Existing non-empty folder requires explicit “Use existing case” or a new subfolder.
- Show available free space.

## 7. Screen 3 — Add source

Cards:

### Physical device

Description:

> Recover from a hard drive, SSD, USB device, or memory card. Administrator permission may be required.

### Disk image

Description:

> Open a RAW, split RAW, E01, or supported forensic image. This is the safest way to repeat an analysis.

### Memory image

Description:

> Analyze a RAM image. Disk recovery and memory analysis remain separate.

Do not show “Folder” as a source for deleted data.

### Device-list presentation

Each `SourceCard` shows:

- Friendly label: “Samsung NVMe SSD — 512 GB.”
- Connection: “Internal NVMe” or “External USB.”
- Relationship: “Contains the running system” when applicable.
- Health: Healthy/Warning/Failing/Unknown.
- Lock badge: Encrypted and locked/unlocked.
- Capability sentence: “Recommended in Rescue Mode” or “Ready for image analysis.”

Technical details accordion:

- Device path.
- Stable ID.
- Logical/physical sector size.
- Model/serial redacted.
- Mount points.

### Click behavior

When a user selects a source:

1. Highlight card.
2. Run assessment in background.
3. Open `/sources/:sourceId/assessment` when complete.
4. If the device disappears, remain on screen and explain it.

## 8. Screen 4 — Source assessment

Header:

- Friendly source name.
- Capacity.
- Runtime mode.
- Read-only state.

Top verdict card examples:

### Ready

> This source can be analyzed safely in the current mode.

### Rescue Mode recommended

> This disk contains the running operating system. Normal activity can overwrite deleted data. Restart in Rescue Mode for the best recovery chance.

Buttons:

- **Use Rescue Mode** — opens instruction modal and generates/copies case handoff information.
- **Continue with limitations** — Advanced only; requires acknowledgement.

### Device failing

> Read errors or health warnings were detected. Repeated scanning may worsen the device. Create a resumable image in Rescue Mode before recovery.

Button: **Start damaged-device workflow**

### Encrypted and locked

> The source is encrypted. Provide an authorized recovery key or unlock it through the operating system before analysis. The platform does not crack passwords.

Button: **Refresh after unlock**

### Assessment sections

- Recovery outlook.
- Partitions/filesystems detected.
- Health and read errors.
- Encryption.
- Recommended workflow.
- Known limitations.

Every technical row has an `InfoPopover` with a one-sentence explanation and an optional “Show technical details.”

## 9. Screen 5 — Choose recovery goal

Cards exactly as defined in the product spec.

For “Find a specific file or folder,” reveal:

- Name contains.
- Former folder path.
- File type families.
- Approximate size.
- Modified date range.
- Known SHA-256, optional advanced field.

Explanatory copy:

> A surviving file record may restore the original name and folder. If only file content remains, the platform may recover the file without its original name or location.

## 10. Screen 6 — Scan options

Three preset cards:

### Quick Scan — Recommended first

- “Looks for deleted file records.”
- “Fastest.”
- “Best chance of original names.”

### Full Scan

- “Includes Quick Scan and searches remaining disk space by file content.”
- “Takes longer.”
- “May produce files without original names.”

### Advanced

- “Choose partitions, file types, ranges, and forensic engines.”
- “For trained examiners.”

Advanced options remain hidden unless selected.

File-family selection uses grouped checkboxes:

- Documents.
- Images.
- Audio/video.
- Archives.
- Databases.
- Executables/scripts.
- Other supported signatures.

Selecting executables/scripts triggers:

> Recovered active content is treated as potentially unsafe and cannot be opened directly from the application.

## 11. Screen 7 — Destination

Show two destination concepts separately:

1. **Image destination** if acquisition is required.
2. **Recovered-file export destination** can be selected later.

Card shows:

- Drive/folder.
- Physical device identity.
- Free space.
- Estimated required space.
- Network/removable status.

Hard-block message:

> Choose a different physical drive. Writing to the source can overwrite data that is still recoverable.

Do not let the user bypass a same-device hard block.

## 12. Screen 8 — Review and start

Summary groups:

- Source.
- Runtime mode.
- Recovery goal.
- Scan preset.
- Destination.
- Estimated range, not a false exact time.
- Warnings.

Acknowledgements appear only when relevant:

- “I understand that continuing on the active system disk can reduce recovery success.”
- “I understand that SSD TRIM may have made deleted data unrecoverable.”
- “I understand that experimental filesystem support may return incomplete results.”

Primary button: **Start recovery**

Secondary: **Back**

No generic “Proceed anyway” wording.

## 13. Screen 9 — Job progress

### Stage timeline

User-facing stage labels:

1. Checking source and destination.
2. Creating a safe disk image.
3. Verifying the image.
4. Finding partitions.
5. Looking for deleted file records.
6. Searching remaining disk space.
7. Checking recovered files.
8. Checking for potentially unsafe content.
9. Preparing results.

Only relevant stages appear.

### Metrics

- Data processed / source size.
- Throughput.
- Estimated time range.
- Files found.
- Read errors.
- Current partition/range in Advanced Details.

### Actions

- **Pause** when supported.
- **Resume** when paused.
- **Cancel scan** opens a dialog:

> Files already recovered will remain in the case. The current stage may be marked partial. You can start a new scan later.

- **Review files found so far** becomes available after indexed artifacts exist.

### Needs-attention states

Source disconnected:

> The source device was disconnected. Reconnect the same device to continue. A different device at the same drive letter will not be accepted.

Destination full:

> The destination is out of space. Select another destination to continue. Existing output will remain unchanged.

Tool failed:

> A recovery component stopped unexpectedly. The case and completed results are safe. Open Technical Details for the component log.

Never show only a stack trace or numeric error code.

## 14. Screen 10 — Results workspace

### Default layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Search | Saved filters | View toggle | Selected count | Export     │
├──────────────┬────────────────────────────────┬────────────────────┤
│ Filters      │ Results                        │ Preview & evidence │
│              │                                │                    │
│ Status       │ Name / type / size / method    │ Preview            │
│ Type         │ original path / date / warning │ Metadata           │
│ Method       │                                │ Recovery evidence  │
│ Partition    │                                │ Threat check       │
│ Date         │                                │ Hex (advanced)     │
└──────────────┴────────────────────────────────┴────────────────────┘
```

### Result columns

Default:

- Selection.
- Name.
- Type.
- Size.
- Recovery status.
- Original location.
- Recovery method.
- Safety status.

Advanced columns:

- SHA-256.
- Source partition.
- File ID/inode.
- Offset ranges.
- Validator.
- Tool.

### Result labels

Metadata result:

- `Original name available`
- `Recovered from file record`

Carved result:

- `Original name unavailable`
- `Recovered by content signature`

Quality:

- Complete and validated.
- Complete but not fully validated.
- Partial.
- Corrupt.

Threat:

- No rule match.
- Potentially unsafe.
- Scan could not complete.

Do not label `NO_RULE_MATCH` as “Safe.”

### Click behavior

Single click:

- Select row.
- Load details.
- Generate preview lazily if allowed.

Double click:

- Does not open the operating-system application.
- Toggles full details view.

Right click:

- Add/remove from export selection.
- Copy hash.
- Copy source reference.
- Mark reviewer note.
- No “Open with system app.”

## 15. Preview panel

Tabs:

1. Preview.
2. Metadata.
3. Recovery evidence.
4. Threat check.
5. Hex, Advanced only.

Examples:

### Safe image

Show sanitized raster preview.

### PDF

Render pages to images in a sandbox; no active content.

### Office document

Show file metadata and extracted safe text/thumbnail when supported. Do not execute macros.

### Executable

Show:

> Preview blocked. This file contains active executable content. Review metadata or export it to a controlled analysis environment.

### YARA-X match

Show:

> Potentially unsafe content detected. Preview is blocked. The match identifies a rule pattern; it is not a final malware verdict.

## 16. Export flow

Step 1: Review selection.

Step 2: Choose destination.

Step 3: Choose organization:

- Preserve original folders where available.
- Organize carved files by type.
- Flat folder with collision-safe names.

Step 4: Collision behavior:

- Keep both with deterministic suffix, recommended.
- Skip identical hashes.
- Replace only after explicit confirmation; not default.

Step 5: Review warnings.

Step 6: Export and verify hashes.

Completion copy:

> 243 files exported and verified. 4 files were renamed to create safe destination paths. 2 potentially unsafe files remain quarantined and were not exported.

## 17. Memory analysis flow

Keep separate from disk recovery.

Screen sequence:

1. Select memory image.
2. Detect probable OS/profile.
3. Choose analysis preset:
   - Processes and command lines.
   - Network connections.
   - Loaded modules/drivers.
   - YARA-X memory scan.
   - Advanced plugin selection.
4. Run Volatility adapter.
5. Review structured tables.
6. Export selected records/report.

Limit message:

> Memory analysis depends on image quality and operating-system symbols. Some images cannot be analyzed completely even when acquisition succeeded.

Live acquisition warning:

> Capturing memory changes a running system and cannot be perfectly non-invasive. Acquire only with authorization.

## 18. Help patterns

### InfoPopover

Use for short definitions.

Example title: **What is a file record?**

> The filesystem may retain a record containing the original name, folder, size, and storage locations after deletion. If the record has been reused, recovery may need to search by file content instead.

### “Why am I seeing this?”

Every block/warning contains this action. It opens a side sheet with:

- What was detected.
- Why it matters.
- What the safest option is.
- What happens if the user continues.
- Technical evidence under an accordion.

### Advanced Details

Contains:

- Raw device path.
- Stable ID.
- Partition offsets.
- File ID/inode.
- Source ranges.
- Tool version.
- Raw error code.

It never replaces plain-language content.

## 19. Empty states

No sources:

> No supported source is connected. Connect a device or open a disk image.

No results after Quick Scan:

> No recoverable file records were found. A Full Scan can search remaining disk space by file content, but original names may not be available.

No results after Full Scan:

> No validated files were recovered. Data may have been overwritten, trimmed, encrypted, or stored in an unsupported format. Review the scan report for details.

Filter hides all results:

> No files match the current filters. Clear filters to view all recovered items.

## 20. Dialog rules

- Use modal dialogs only for decisions that must block progress.
- Use side sheets for explanations and advanced details.
- Use toast messages for completed background actions, never for critical failures requiring a decision.
- Preserve context: closing an info sheet returns focus to the triggering control.
- Escape closes non-destructive dialogs; it does not silently cancel active jobs.

## 21. Keyboard behavior

- `Ctrl/Cmd+N`: new case.
- `Ctrl/Cmd+O`: open case.
- `Ctrl/Cmd+F`: focus results search.
- Space: toggle selected result when table has focus.
- Enter: open full result details.
- `Ctrl/Cmd+E`: open export flow when selection exists.
- `?`: open shortcut help when not typing in a field.

All shortcuts must have menu equivalents.

## 22. Accessibility requirements

- Every job progress message is placed in a polite status live region.
- Blocking errors use an alert role.
- Focus indicator is at least 2 px and has strong contrast.
- Sticky headers do not obscure focused controls.
- Table supports keyboard row navigation without trapping focus.
- Icon-only buttons have accessible names and tooltips.
- Charts are optional; all important data is also text.
- Motion is reduced when the OS requests reduced motion.

## 23. Content style

Voice:

- Direct.
- Calm.
- Non-judgmental.
- Precise about uncertainty.

Good:

> The file content was recovered, but its original name and folder were not available.

Bad:

> Amazing! Your lost file has been rescued!

Good:

> Recovery could not continue because the destination is full. Select another destination; completed results are preserved.

Bad:

> Error 0x80070070.

## 24. Storybook screen states

Create stories for:

- Welcome Installed Mode.
- Welcome Rescue Mode.
- Source ready.
- Active system disk warning.
- Failing device.
- Locked encrypted source.
- Job running.
- Job paused.
- Source disconnected.
- Destination full.
- Results with metadata and carved items.
- One million result rows using generated data.
- Threat match preview blocked.
- Empty Quick Scan.
- Empty Full Scan.
- Dark mode.
- 200% text zoom.
- Keyboard focus states.

## 25. UI acceptance checklist

- A guided operator can start an image-file recovery without seeing a device path or inode.
- A forensic examiner can access every technical fact through Advanced Details.
- The user can always identify source, destination, runtime mode, and current stage.
- The app never implies that a carved file has a known original folder.
- The app never labels a YARA-X no-match result as safe.
- The current system disk path directs the user to Rescue Mode.
- A same-device destination cannot be selected.
- Progress survives route changes and application restart.
- One million rows do not freeze the renderer.
- No recovered executable is opened by double click.

