# SHUNYA video narration

Recording length: **3 minutes 47.6 seconds**

Read at a fast but clear demonstration pace of roughly **155–165 words per minute**. Do not read the timestamps or the text in square brackets. Keep moving through the narration while folders load, then pause for half a second after each click.

## Timed teleprompter script

### 0:00–0:17 | Completed case overview

[Keep the pointer around the summary cards.]

Hello everyone. Today I’m demonstrating SHUNYA Recovery, a cross-platform Electron application for controlled, read-only data recovery. I’ll show how we create a case, select a RAW image, recover evidence, verify and export the result, and generate an audit report. We begin with a completed case overview.

### 0:17–0:22 | Cases screen

[Move to Cases, then start a new recovery.]

I’ll return to Cases and create a fresh disk-image recovery.

### 0:22–0:50 | Enter case details

[Type naturally and pause briefly after each field.]

Each recovery begins with a case instead of an untracked scan. I enter a descriptive title, the operator identity, a reference number, and the organization handling the evidence. These fields establish the audit and chain-of-custody context. They do not change the recovery algorithm. The daemon persists them with the activity log, recovered findings, exports, and reports, so another operator can understand who created the workspace and why it exists.

### 0:50–1:08 | Choose the workspace

[Choose the parent folder and allow the folder tree and storage graphic to appear.]

I choose a parent folder through the native Windows picker. SHUNYA displays its folder tree, checks free storage, and shows the full case directory it will create. The daemon refuses to overwrite an existing workspace and keeps the destination separate from the evidence image.

### 1:08–1:21 | Review and create the case

[Move over the review information, then create the case.]

Before creation, I review the metadata, workspace path, and safety checks. The new case separates reference records, recovered files, reports, and the activity log. SHUNYA keeps the evidence source outside that workspace and read only.

### 1:21–1:53 | Select the recovery source

[Let the source screen load. Choose the RAW image with the file picker, then add it.]

Now I select the evidence source. SHUNYA lists attached physical devices, including the internal NVMe drive and the SanDisk USB device, but I avoid the Windows system drive. For this controlled demonstration, I choose a small RAW image with the native file picker. A RAW image is a sector-level byte copy, so it can preserve deleted content that the live file system no longer lists. SHUNYA registers the selected path as an evidence source and applies write blocking before analysis begins.

### 1:53–1:59 | Source safety assessment

[Pause on the green Ready state and the read-only panel.]

The safety assessment confirms that installed mode can examine this image while keeping the source unchanged.

### 1:59–2:03 | Choose the recovery goal

[Select Recover everything.]

I choose Recover everything to use all supported recovery methods.

### 2:03–2:07 | Choose scan options

[Select Full Scan, then Use this preset.]

I select Full Scan to examine the complete byte range.

### 2:07–2:34 | Partition discovery

[Keep the pointer near the detected-layout graphic, then move to View recovery activity.]

Partition discovery inspects the image for a usable disk layout. This fixture contains no partition table, so SHUNYA records its 4,161 bytes as an unallocated range. The source stays read only, and the daemon writes no replacement partition table. With no file-system directory to traverse, Full Scan uses signature-based carving. The bounded JPEG engine searches the raw bytes for valid start and end markers, recovering content without an original filename or folder.

### 2:34–2:44 | Activity and recovered result

[Show the completed checkpoints, then open Review recovered files.]

The activity screen records the checkpoint sequence and final job state. The scan recovered one JPEG. Results stores its source offset, 75-byte length, recovery condition, and SHA-256 evidence hash.

### 2:44–3:04 | Verified export

[Review the selected item, choose the export folder, authorize the export, and start it.]

Export runs as a verified operation. I select the artifact, choose a destination with the native picker, and authorize the copy. The daemon checks the physical topology of the source, protected workspace, and export destination, rejecting unsafe overlap. SHUNYA then hashes the exported bytes and compares them with the recorded artifact hash to verify the copy.

### 3:04–3:16 | Generate the report

[Open Reports and generate the report.]

Generate report creates deterministic JSON evidence for machine processing and a Markdown summary for review. It preserves the TSK, PhotoRec, and YARA-X warnings and records the bounded JPEG engine used for this run.

### 3:16–3:25 | Quick navigation tour

[Move through Results, Recovery, Settings, and Help as recorded.]

The sidebar keeps Results, source controls, application safeguards, Settings, and Help available while the operator remains inside the same case context.

### 3:25–3:34 | Cases and persisted state

[Open New case, return to Cases, then continue the completed case.]

From Cases, I can begin another investigation or reopen this completed case. The daemon restores its sources, job state, recovered findings, limitations, and reports from persisted records.

### 3:34–3:48 | Closing

[Show the result briefly, then finish on Cases.]

This completes the SHUNYA workflow: create an auditable case, protect the source, run full recovery, inspect the artifact, perform a hash-verified export, and generate repeatable reports. The case connects each result to its source offset, recovery history, operator, and cryptographic verification data.

## Screen timing map

| Time | Screen |
|---|---|
| 0:00–0:17 | Existing completed case overview |
| 0:17–0:22 | Cases |
| 0:22–0:50 | New case details |
| 0:50–1:08 | Workspace selection |
| 1:08–1:21 | Case review and creation |
| 1:21–1:53 | Recovery source selection |
| 1:53–1:59 | Source safety assessment |
| 1:59–2:03 | Recovery goal |
| 2:03–2:07 | Full Scan preset |
| 2:07–2:34 | Partition discovery |
| 2:34–2:44 | Activity and recovered result |
| 2:44–3:04 | Verified export |
| 3:04–3:16 | Report generation |
| 3:16–3:25 | Results, Recovery, Settings, and Help |
| 3:25–3:34 | New case, Cases, and reopening the case |
| 3:34–3:48 | Final result and closing Cases screen |
