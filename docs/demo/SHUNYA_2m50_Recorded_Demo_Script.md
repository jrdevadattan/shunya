# SHUNYA Recovery: 2 Minute 50 Second Recorded Demo Script

Recording: `C:\Users\J R Deva Dattan\Videos\SHUNYA-Recovery-Demo-Final.mp4`

Delivery pace: about 125 words per minute. Keep the wording conversational. Follow the cursor and let the screen change before starting the next block.

## 0:00–0:22 — Case overview and introduction

**On screen:** Hold on the Recovery overview. The cursor stays still for the opening.

**Say:**

“SHUNYA is an offline-first forensic recovery workstation. This demo uses a small test case with no private data. A case is the controlled workspace for one investigation: it links evidence sources, recovery jobs, checkpoints, artifacts, and reports. The Electron interface reads these records from the Rust recovery daemon.”

## 0:22–0:42 — Explain the overview cards

**On screen:** The cursor moves across Sources, Recovery job, Recovered artifacts, and Limitations.

**Say:**

“The overview shows three evidence sources, one completed job, one indexed artifact, and three limitations. The daemon persists these values in the case workspace. SHUNYA names missing Sleuth Kit, PhotoRec, and YARA-X capabilities so the examiner can judge the boundary of the result.”

## 0:42–1:00 — Read-only source inventory

**On screen:** Open Recovery and point to the two physical devices and `carving-fixture.raw`.

**Say:**

“Recovery lists two physical devices and a small RAW image. SHUNYA opens supported evidence sources read-only and sends output to a separate workspace. This rule protects source bytes from modification and supports repeatable analysis. The demo job uses the RAW image.”

## 1:00–1:20 — Job event timeline

**On screen:** Open Case activity and show the first events.

**Say:**

“Case activity shows ordered records from the case store and recovery daemon: case creation, job start, and preflight checkpoints. The job then runs partition scan, metadata scan, carving, validation, threat scan, indexing, review-ready, and completion stages. Each persisted event carries a sequence number and stage name.”

## 1:20–1:40 — Later checkpoints and honest limitations

**On screen:** Scroll through the later checkpoints, then return to the top where the audit warning appears.

**Say:**

“These checkpoints help an operator inspect progress and resume supported work after interruption. SHUNYA marks the audit hash-chain endpoint as unavailable and makes no unsupported integrity claim. The interface presents that limitation beside the append-only event timeline.”

## 1:40–2:05 — Recovered artifact and carving

**On screen:** Open Verify. Point to the recovered JPEG, protected-preview notice, and evidence list.

**Say:**

“Verify contains one JPEG recovered through content-signature carving. Carving scans raw bytes for known file markers, so it can find content after filesystem directory metadata disappears. The daemon records the artifact as complete and validated. Its original name remains unavailable, while protected preview prevents SHUNYA from launching active recovered content.”

## 2:05–2:22 — Hash and source provenance

**On screen:** Point to SHA-256, then expand Source byte ranges.

**Say:**

“The detail panel records SHA-256 and the source byte range: offset nineteen, length seventy-five bytes. The hash identifies the output, while the offset links it to a precise source region. The case states that the bounded JPEG engine replaced PhotoRec and YARA-X did not scan the content.”

## 2:22–2:45 — Persisted reports

**On screen:** Show Report output ready, JSON evidence record, Markdown recovery summary, and warnings.

**Say:**

“Reports generates deterministic outputs from persisted daemon records. JSON provides a machine-readable evidence record, while Markdown provides a readable recovery summary. SHUNYA stores both files in the case reports directory and carries the tool limitations into their evidential context. The interface displays each path without opening recovered content or reports.”

## 2:45–2:50 — Closing overview

**On screen:** Return to Recovery overview and hold.

**Say:**

“The case retains its sources, job history, artifact provenance, and report for review.”

## Recording notes

- The video contains no audio track, so you can record this narration as voice-over or read it while playing the video.
- The opening remains at normal speed for a full twenty-two seconds. Later pauses were tightened to keep the finished video at 2:49.96.
- Avoid claiming that the artifact passed a YARA-X scan or that SHUNYA verified an audit hash chain. The application labels both capabilities as unavailable in this case.
