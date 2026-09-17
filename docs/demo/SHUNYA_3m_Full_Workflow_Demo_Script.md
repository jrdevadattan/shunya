# SHUNYA Recovery: Three-Minute Full Workflow Demo

Recording: `C:\Users\J R Deva Dattan\Videos\SHUNYA-Recovery-Full-Workflow-Final.mp4`

Target delivery: about 125 words per minute. Read this as a live demonstration. Follow the pointer, and let each screen appear before describing it.

## 0:00–0:08 — Open on Cases

**On screen:** Hold on **Cases**, then move the pointer to **New recovery**.

**Say:**

“This is SHUNYA, an offline-first recovery workstation. I’ll create a case, recover a prepared disk image, verify it, and generate a report.”

## 0:08–0:40 — Create the case record

**On screen:** Type the title, operator, reference number, organization, and notes.

**Say:**

“A case is the controlled workspace for one recovery investigation. I’m entering a case title, the examiner’s identity, an external reference, and handling notes. SHUNYA stores these details with the source inventory, recovery jobs, checkpoint history, recovered artifacts, and reports. Keeping that context together makes the run reviewable instead of leaving us with an unexplained collection of files.”

## 0:40–1:05 — Choose the workspace

**On screen:** Open the Windows folder picker, navigate to Desktop, type the parent path, and select it. Show the folder tree and storage graphic.

**Say:**

“Now I select a writable parent folder through the native Windows picker. SHUNYA creates a new child workspace and refuses to overwrite an existing destination. The tree confirms the exact location, while the storage graphic checks available capacity. The evidence source and output workspace remain separate, which prevents recovery writes from changing the source being examined.”

## 1:05–1:16 — Review and create

**On screen:** Review the case summary and create the case.

**Say:**

“The review screen shows what SHUNYA will create. I confirm the destination and case folder, then create the persisted case.”

## 1:16–1:34 — Add the evidence source

**On screen:** Show detected devices, select the image option, type the RAW image path, and add it.

**Say:**

“SHUNYA inventories the attached physical devices, including the USB drive, and also accepts an existing disk image. For this controlled demo I enter a prepared RAW image. The recovery daemon opens supported evidence sources read-only and records the selected path, media type, and size.”

## 1:34–1:59 — Configure recovery

**On screen:** Show source assessment, select **Recover everything**, choose **Full Scan**, and display the partition map.

**Say:**

“The source assessment confirms a RAW image and the read-only safety boundary. I choose Recover everything, then Full Scan. This enables the broad recovery path: partition discovery, filesystem metadata analysis where supported, and content-signature carving. Carving searches raw byte patterns for known headers and footers, so it can recover files even when directory metadata is missing.”

## 1:59–2:17 — Follow the job checkpoints

**On screen:** Open **Case activity** and scroll through the checkpoint list.

**Say:**

“Case activity records the job as ordered checkpoints: preflight, partition scan, metadata scan, carving, validation, threat scan, indexing, review ready, and completion. These persisted events give the examiner a stage-by-stage account of what the daemon attempted and which capabilities were available.”

## 2:17–2:30 — Verify the recovered artifact

**On screen:** Open **Verify**, point to the JPEG result and SHA-256 value, then expand the source byte range.

**Say:**

“Verify shows a JPEG recovered by signature carving. SHUNYA calculates its SHA-256 digest and records provenance to source offset nineteen for seventy-five bytes, tying the output to the exact image region.”

## 2:30–2:53 — Generate the report

**On screen:** Open **Reports**, generate the report, and show both output files and the limitations panel.

**Say:**

“The report generator writes a machine-readable JSON evidence record and a readable Markdown summary from persisted daemon data. Protected preview avoids launching recovered content, and the report carries unavailable-tool warnings forward so the examiner can judge the limits of this run.”

## 2:53–2:58 — Confirm persistence

**On screen:** Return to **Cases** and hold on the new entry.

**Say:**

“The completed case now remains available for review.”

## Recording notes

- The video is silent so you can record this narration as a voice-over.
- The pointer and blue click halo are part of the recording.
- The demo uses a prepared, non-sensitive RAW image rather than a live system drive.
- Do not claim that YARA-X, PhotoRec, or Sleuth Kit completed work when the report lists those tools as unavailable.
