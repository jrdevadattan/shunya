# SHUNYA Recovery: Technical Demonstration Video Script

**Target duration:** 4 to 5 minutes

**Speaking pace:** 135 to 145 words per minute

**Recording setup:** Capture the SHUNYA window in OBS Studio. Keep the pointer visible, enlarge it if needed, and record the microphone on a separate audio track.

## Presenter notes

- Treat the text in **On screen** as direction, not narration.
- Pause for one second after changing screens so viewers can follow the interface.
- Use a small test disk image. Never demonstrate against your active system disk.
- If the current build reports a capability limitation, show it. The product gains credibility by explaining what it can and cannot verify.

## 0:00 to 0:30: Problem and product

**On screen:** Open SHUNYA on the Cases screen. Move across the three recovery paths, then select **New recovery**.

**Narration:**

> Data recovery becomes risky when a tool writes back to the same device, hides technical limitations, or mixes recovered files with the original evidence. SHUNYA Recovery is an offline-first forensic recovery workstation built for a safer process. It organizes each investigation as a case, keeps the source read-only, records what the software does, and exports recovered data to a separate destination. The interface guides a regular operator, while the case records retain the technical detail needed by an examiner.

## 0:30 to 1:10: Architecture and security boundary

**On screen:** Show the application shell and the Installed Mode status. Open **About** for a moment, then return to **New case**.

**Narration:**

> The desktop layer uses Electron, React, and TypeScript. Recovery runs in a separate Rust daemon, so the renderer never receives raw disk access. Electron disables Node integration and enables context isolation and sandboxing. A narrow preload API validates requests and responses against typed schemas.
>
> Before launch, Electron verifies the daemon executable with SHA-256. It then sends structured JSON RPC through standard input and output without a command shell. The main process rejects requests from an untrusted renderer. Filesystem, hashing, export, and case-integrity operations stay inside the Rust boundary.

## 1:10 to 1:55: Case and workspace creation

**On screen:** Enter a case title and operator. Choose a destination folder. Expand part of the folder tree and point to the storage graphic. Create the case.

**Narration:**

> I will create a case before selecting evidence. SHUNYA displays a bounded folder tree and reads real storage information from the operating system. It resolves canonical paths, avoids symbolic-link loops, and limits traversal depth and entry count.
>
> Case creation uses a staging directory and an atomic rename, and it will not overwrite an existing non-empty destination. The workspace contains a JSON manifest, a SQLite database, an audit stream, sources, checkpoints, quarantined output, exports, logs, and reports. SQLite write-ahead logging preserves durable job state.

## 1:55 to 2:30: Source selection and safety preflight

**On screen:** Add a test RAW image. Show its assessment, identity, size, health, encryption state, and safety findings. Continue to the recovery goal screen.

**Narration:**

> Next, I add a forensic disk image. SHUNYA records its stable identity, size, type, system-disk relationship, encryption state, and health findings. Before a job starts, the Rust safety policy revalidates the source and checks for a changed identity, an active system disk, unsupported media, or encryption restrictions.
>
> The source stays read-only. SHUNYA does not repair a partition table, undelete in place, or mount evidence for writing. A safety block returns a typed explanation.

## 2:30 to 3:40: Recovery pipeline

**On screen:** Select **Recover everything**, choose **Full Scan**, and show the recovery activity screen as the stages advance.

**Narration:**

> A recovery job combines the case ID, source ID, goal, and scan preset. The backend executes it as a checkpointed state machine.
>
> Preflight hashes the source with SHA-256. Partition discovery parses GPT or MBR structures and records candidate volumes without writing them back. Metadata recovery comes first because surviving filesystem records can preserve names, folders, timestamps, and data extents.
>
> When metadata is missing, content-signature carving searches for recognizable file boundaries. This packaged vertical slice includes a bounded JPEG engine. The architecture supports verified adapters for The Sleuth Kit and PhotoRec, but SHUNYA reports them as unavailable when their approved binaries are absent. It does not invent a filename or claim metadata recovery that did not occur.
>
> Recovered artifacts pass deterministic signature, boundary, structure, and hash checks. Each receives a complete, partial, corrupt, or unverified status. Threat classification remains separate. If YARA-X is absent, SHUNYA marks the file as not scanned and restricts preview. The daemon then indexes normalized results in SQLite.

## 3:40 to 4:25: Results, export, reporting, and recovery after interruption

**On screen:** Open **Results**, select a safe artifact, show its source range and recovery method, then open **Export** and **Reports**. End on **Case activity**.

**Narration:**

> Results show the recovery method, original-name availability, source byte range, validation status, SHA-256 hash, and threat status. Metadata results and carved results stay distinct because a carved payload cannot prove its former path.
>
> Export normalizes paths, blocks directory traversal, handles filename collisions, and refuses the source physical device as a destination. SHUNYA hashes each exported file and compares it with the indexed artifact hash.
>
> The report generator creates JSON evidence and a readable Markdown summary from persisted daemon records. It includes the case, source identity, hashes, stages, limitations, and export evidence. Checkpoints support pause, resume, and recovery after interruption. An interrupted job reopens in a recoverable paused state without repeating completed stages.

## 4:25 to 4:50: Closing

**On screen:** Return to the recovery overview and show the source, job, artifact, and limitation cards.

**Narration:**

> SHUNYA combines a guided interface with a case-based forensic architecture. It reads from the source, records each stage, explains limitations, validates recovered data, and verifies exports. The Windows build works today, while the Electron and Rust foundation also supports Linux, macOS, and Rescue Mode packaging.

## Short closing line for a competition video

> SHUNYA helps an operator recover what remains without changing the evidence or overstating what the software can prove.

## Pronunciation guide

- **SHA-256:** “S H A two fifty-six”
- **JSON RPC:** “Jay-son R P C”
- **SQLite:** “S Q Lite”
- **GPT and MBR:** Say each letter
- **YARA-X:** “Yara X”
- **The Sleuth Kit:** “The slooth kit”
- **PhotoRec:** “Photo rec”
