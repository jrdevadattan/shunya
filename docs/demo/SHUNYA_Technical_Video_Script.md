# SHUNYA Recovery — Guided Technical Demonstration Script

**Target duration:** 5½ to 6 minutes
**Format:** Live application demonstration with voice-over
**Speaking pace:** About 130 words per minute

This is not a speech. Follow the actions in order and speak while the matching screen is visible.

## Before recording

- Open SHUNYA on the **Cases** screen in light theme.
- Prepare a small, non-sensitive RAW test image. Do not use your Windows system drive.
- Prepare an empty parent folder on a different writable drive for the case workspace.
- Use a demo image that produces at least one metadata result and one carved JPEG if possible.
- Run the recovery once before recording so you know how long it takes. If it takes more than a few seconds, record the start and completion separately and use a clean cut.
- Keep the mouse pointer visible. After every click, pause briefly so the audience can see the resulting state.

## 0:00–0:25 — Introduce the workflow

**Screen:** **Your recovery cases**. Slowly point to **Recover from a device**, **Analyze a disk image**, and **Analyze a memory image**. Then click **New recovery**.

**Say:**

> This is SHUNYA Recovery, an offline-first tool for controlled file recovery and forensic review. I will create a case, attach a RAW image as the read-only source, run a recovery job, inspect the evidence, export a verified file, and generate a report. I am using a test image, not the active Windows disk.

## 0:25–1:10 — Explain and create a case

**Screen:** **Details** step. Enter a clear case title such as `Deleted Photos Demo`, an operator name or ID, and a reference number. Point to the **Case workspace blueprint**.

**Say:**

> The first object is a case: the container for one investigation. It connects the case identity and operator with its sources, recovery jobs, artifacts, exports, reports, and activity. Its dedicated workspace keeps the recovered data and technical records together.
>
> Creating a case does not start a scan. It creates the workspace and case record. The recovery job comes later, after I choose a source, goal, and scan preset.

**Action:** Click **Continue to workspace**.

## 1:10–1:50 — Choose and explain the workspace

**Screen:** **Workspace** step. Click **Choose parent folder** and select the prepared parent folder in the native Windows picker. When SHUNYA returns, slowly point to the folder tree, case-folder name, storage bar, free-space value, and **What will be created** path.

**Say:**

> I am choosing the workspace parent with the native Windows picker. SHUNYA shows a bounded folder-tree preview and real drive capacity. This tree is the existing parent; the path on the right is the new child folder SHUNYA will create.
>
> The parent may contain other data, but the new case name must not already exist; SHUNYA will not overwrite it. The workspace holds the manifest, SQLite database, checkpoints, recovered output, exports, logs, and reports. This is investigation storage, not the source being recovered.

**Action:** Click **Continue to review**. On **Review**, point to the case identity, full destination path, free-space check, and read-only statement. Click **Create case**.

## 1:50–2:30 — Attach the recovery source

**Screen:** **Select recovery source**. Enter or paste the path of the prepared RAW image into **Disk image path**, then click **Add image source**.

**Say:**

> Now I attach the source—the device or image containing the lost data. For a repeatable demo I am using a RAW image. SHUNYA records supported evidence read-only, and never writes recovered files back to this source.
>
> The Electron interface does not perform raw recovery itself. Typed requests cross a restricted preload boundary to a separate Rust daemon, where filesystem access, hashing, scanning, validation, export, and persistence run.

**Screen:** **Source safety assessment**. Point from the source node, across **Read-only analysis path**, to **Recovery workspace**. Point to the daemon findings.

**Say:**

> The daemon assesses the source identity, size, type, encryption state, system-disk relationship, and safety findings. This diagram shows the direction: read from the source, write only into the workspace. An unsafe or uncertain condition produces a warning or block instead of a guess.

**Action:** Click **Choose recovery goal**.

## 2:30–3:05 — Choose the recovery strategy

**Screen:** **What do you want to recover?** Point briefly to the goal cards. Select **Recover everything**, then click **Continue to scan options**.

**Say:**

> The recovery goal records the operator’s intent. Recently Deleted prioritizes surviving records; Specific Target narrows the search; Partition Loss looks for missing structures. I am choosing Recover Everything: metadata first, then remaining source space by content signature.

**Screen:** **Choose scan options**. Point to **Quick Scan** and **Full Scan**.

**Say:**

> Quick Scan concentrates on file records, which may preserve names, folders, timestamps, and data extents. Full Scan adds content-signature recovery, or file carving. Carving can find a payload after directory records are lost, but cannot normally prove its old name or folder. I will use Full Scan.

**Action:** Click **Use this preset** under **Full Scan**.

## 3:05–4:05 — Demonstrate the recovery job and pipeline

**Screen:** **Partitions found** and then **Recovery** or **Case activity**, depending on the job state. Point to the partition map/tree, stage timeline, source-to-workspace relationship, controls, and event stream. If needed, cut to the completed job.

**Say:**

> This creates the recovery job: one execution of a chosen strategy against this source. The job has its own identifier, preset, status, events, limitations, and recoverable state.
>
> The daemon runs preflight and hashes the source with SHA-256. It reads GPT or MBR structures and records detected or candidate partitions without repairing the partition table. Metadata recovery runs first; then the full preset performs bounded signature carving. This build includes JPEG carving.
>
> Before indexing, each artifact is classified as complete, partial, corrupt, or unverified and linked to its digest and source byte ranges. Threat classification is separate. If YARA-X is unavailable, SHUNYA says not scanned rather than claiming safety.
>
> The bar shows workflow stage, not invented byte progress. Events come from the Rust daemon. Backend checkpoints support pause, resume, and reopening an interrupted job.

## 4:05–4:55 — Inspect recovered files and provenance

**Screen:** Click **Results**. Use **Original folders**, then **Content-signature recovery**. Select one artifact in the table. Point to its condition, preview protection, original-path statement, SHA-256 value, threat result, and expandable source byte ranges.

**Say:**

> Results is an evidence browser. Metadata results can form the folder tree because surviving records provide path provenance. Carved artifacts remain separate because a content signature cannot prove their previous location.
>
> This panel shows the method, condition, path evidence, threat status, digest, and exact source ranges. Complete and validated means it passed the available deterministic checks. No rule match is not a promise of safety. Recovered originals are not launched automatically.

**Action:** Tick one complete, validated artifact and click **Review export**.

## 4:55–5:30 — Export with verification

**Screen:** **Exports**. Point to the source → protected workspace → export destination diagram and the selection summary. Enter a separate writable export path and click **Start verified export**. Point to **Export complete and verified** and **SHA-256 verified**.

**Say:**

> Export is a controlled copy from the case workspace. The daemon derives physical-device topology and refuses the export unless source and destination separation can be proved. It also normalizes paths, blocks directory traversal, handles name collisions, and requires authorization for potentially unsafe content.
>
> SHUNYA hashes each exported copy and compares it with the indexed digest. SHA-256 verified confirms that these exported bytes match the artifact recorded in the case.

## 5:30–5:55 — Generate the case report

**Screen:** Click **Reports**, then **Generate report**. Point to the JSON path, Markdown path, and limitations panel. Finish on **Case activity**.

**Say:**

> Finally, the daemon generates JSON evidence and a readable Markdown report from persisted records, including limitations. The renderer does not invent findings. Case Activity shows case creation and the available daemon job events in chronological order.

## 5:55–6:10 — Close the demonstration

**Screen:** Return to **Recovery** or **Cases** and leave the completed case visible.

**Say:**

> That is the SHUNYA workflow: create a case, attach a read-only source, run a defined recovery job, preserve provenance, verify the export, and document the investigation. It retrieves data while showing how each result was obtained and what can—and cannot—be proved.

## Teleprompter and editing cues

- Do not read headings or action instructions aloud; read only the quoted narration.
- When a technical value is visible, point to it instead of trying to memorize its exact value.
- Leave about half a second between sentences when changing screens.
- Use a clean cut while the recovery job is running. Do not claim the cut represents real-time speed.
- If your demo does not produce a metadata result, describe that section using the visible carved result only.
- If YARA-X, The Sleuth Kit, or PhotoRec is shown as unavailable, keep that limitation on screen. Do not imply that an unavailable adapter ran.

## Pronunciation

- **SHA-256:** “S H A two fifty-six”
- **SQLite:** “S Q Lite”
- **GPT / MBR:** Say each letter
- **YARA-X:** “Yara X”
- **The Sleuth Kit:** “The slooth kit”
- **PhotoRec:** “Photo rec”
