# Prototype Video Script — SHUNYA

**Problem Statement 149 · National Technical Research Organisation (NTRO)**
*Design and Development of an Integrated Secure Data Erasure and Advanced File Recovery Tool for Digital Forensics and Data Sanitization*

**Runtime:** 4 minutes 30 seconds · **Voice:** one narrator, calm and confident · **Screen:** SHUNYA running on Windows, light theme

> **How to use this file.** The left column is what the viewer *sees*. The right column is what the narrator *says* — read it out loud once before recording; it is written for the ear, not the eye. Timings are targets, not handcuffs.

---

## The one-sentence pitch (put this in the video description too)

> **SHUNYA is one offline tool that does both halves of the data lifecycle: it brings deleted files back when you need them, and destroys data beyond recovery when you don't — and it hands you signed, verifiable proof of whichever one you did.**

---

## Section 1 — The hook (0:00 – 0:30)

| On screen | Narration |
|---|---|
| Black. A single line of text fades in: **"Delete"**. Then, underneath: **"…doesn't mean gone."** | When you delete a file, your computer doesn't erase it. |
| Animation: a book. A page is listed in the index; the index entry is struck through; the **page itself stays in the book**. | It just crosses the name out of an index. The data is still sitting on the disk, waiting to be written over. |
| Cut: a laptop being handed to a recycler. Then: a police evidence bag. | That one fact creates two very different problems. If you're an investigator, that deleted file is evidence you need to bring back. If you're retiring a thousand office laptops, that leftover data is a breach waiting to happen. |
| Logo animates in: **SHUNYA**, with the tagline **"Recover what matters. Destroy what shouldn't remain."** | Both problems are the same problem, seen from opposite ends. So we built one tool that solves both. This is SHUNYA. |

---

## Section 2 — What it is (0:30 – 0:55)

| On screen | Narration |
|---|---|
| App opens on the Home screen. Three large cards are visible: **Recover files**, **Securely delete**, **Make a disk image**. Cursor rests, doesn't click yet. | This is the whole product on one screen. Recover files. Securely delete. Or make a forensic copy of a drive first. |
| Slowly highlight the bottom-left of the sidebar: the green **"Source writes blocked"** badge. | Everything runs completely offline — no cloud, no accounts, no data leaving the machine. And notice the green badge down here. It never goes away. |
| Zoom on the badge. | The original drive is opened read-only. SHUNYA physically cannot write to your evidence. That isn't a setting anyone can switch off — it's how the tool is built. |

---

## Section 3 — Step one: photograph the scene (0:55 – 1:25)

| On screen | Narration |
|---|---|
| Click **Make a disk image**. The device list appears: the internal NVMe drive is greyed out and labelled **"System disk — protected"**; the SanDisk USB drive is selectable and labelled **"Removable"**. | First, good forensic practice: don't work on the original. Make a copy. |
| Hover the greyed-out system disk so the label is readable. | And look — your own system drive can't even be selected. A mis-click can't touch the machine you're standing at. |
| Select the USB drive, choose **Entire drive**, pick a save location, click **Copy**. Progress bar moves. | We pick the USB drive, choose where to save, and SHUNYA reads it sector by sector into a single image file. |
| Result panel appears with the **SHA-256** hash highlighted. | As it reads, it calculates a SHA-256 fingerprint — a 64-character code that changes completely if even one byte of that image ever changes. That fingerprint is your proof the copy is faithful. From here on, we work on the copy. The original goes back in the evidence bag, untouched. |

---

## Section 4 — Recovering the files (1:25 – 2:20)

| On screen | Narration |
|---|---|
| Home → **Recover files**. Case form: type a title ("Q4 workstation recovery") and an operator name. Click **Create case**. | Now the recovery. Every job starts as a case — a title, who's running it, and a folder where everything lands. That's the chain of custody, started automatically. |
| Choose the `.raw` image file → **Continue**. The set-up screen loads. A green check reads **"Source is ready"**. | We point it at the image we just made. SHUNYA checks it and confirms it's ready. |
| Camera settles on the six **file family** cards: Images, Documents, Archives, Audio & video, Databases, Executables. All are ticked. | And here's the only real decision the user has to make: what are you looking for? Photos. Documents. Archives. Video and audio. Databases. Programs. |
| Untick a couple, then re-tick all six. Highlight the counter: **"6 of 6 families · 30 signatures"**. | Six families, covering thirty-plus file formats. Tick what you need, leave the rest. |
| Briefly expand **Advanced options** to show recovery goal and scan depth, then collapse it again. | Everything technical — scan depth, recovery strategy — has a sensible default and lives one click away, under Advanced. A first-time user never has to open it. |
| Click the big orange **Start recovery** button. | Then you press one button. |
| Live job screen: status headline, one big percentage, the stage strip lighting up in sequence. | And this is where the real work happens. |

---

## Section 5 — How it actually finds the files (2:20 – 2:55)

| On screen | Narration |
|---|---|
| Animation over the live screen: a long grey bar of raw disk bytes. A small coloured block lights up inside it. | Since the file names are gone, SHUNYA doesn't look for names. It reads the raw disk and looks for *shapes*. |
| The block expands to show `FF D8 FF` at the start and `FF D9` at the end — a JPEG. | Every file type has a signature — a fingerprint in its first few bytes. A JPEG photo always starts the same way. So does a PDF, a Word document, a SQLite database. |
| Show the engine walking the internal structure: chunk boundaries ticking along until the true end of the file. | But finding the start is the easy part. SHUNYA then walks the file's own internal structure to find exactly where it ends — the chunk table in a PNG, the box list in an MP4, the central directory in a Word file. That's how it recovers a whole, openable file instead of a corrupted fragment. |
| Stage strip advances to validation, then to threat scan. | Every file it pulls out is then checked for completeness, and scanned for malware signatures before you are ever allowed near it. |

---

## Section 6 — The results, and a nasty surprise (2:55 – 3:25)

| On screen | Narration |
|---|---|
| **Recovery completed.** Click **Review recovered files**. The results table fills: JPEGs, a PNG, a PDF, a DOCX, a SQLite database, a WAV, a ZIP. | Twelve files back. Photos, a PDF, a Word document, a database, audio — all recovered from a drive where they'd been deleted. |
| Click the type filters in the left rail; the table narrows and widens. | You can filter by type, search by name, and inspect any file. |
| Click a recovered JPEG. Right panel shows SHA-256 and the byte offset it came from. | For each one SHUNYA shows you its fingerprint and the exact byte offset it was carved from — so the file can be traced straight back to a physical location on the original disk. |
| Click the file flagged in red: **"Potential threat"**. | And here's the one we care about. |
| Zoom on the red badge and the blocked preview panel. | One of the recovered files matched a malware signature. SHUNYA flagged it, quarantined it, and refuses to preview or open it. Recovering data from a compromised machine should never be the thing that infects the investigator's machine. |
| Tick a few files → **Review export** → choose a folder → **Start verified export**. Green result appears. | Exporting is just as careful. Every copied file is hashed and compared against the original, and the tool refuses to write onto the same drive it's reading from. |
| **Report** screen: JSON and Markdown files listed. | And the case report writes itself — a machine-readable record and a readable summary, straight from what actually happened. |

---

## Section 7 — The other half: destroying data (3:25 – 4:10)

| On screen | Narration |
|---|---|
| Home → **Securely delete**. | Now flip the problem around. Same tool. |
| Step 1: choose a folder on the USB drive. The plan appears: device model, file count, total size, a preview of the files. | Say you're retiring a drive, or a folder has to be destroyed for good. Point SHUNYA at it, and before it touches anything, it shows you exactly what will be destroyed. |
| Step 3: the red confirmation box. Type the full folder path. The button enables. | To go ahead, you type the full path by hand. No accidental clicks. |
| Click delete. Progress runs. | Then, file by file, SHUNYA overwrites the contents with cryptographically random data, truncates it, renames it, and unlinks it. |
| Animation: a page of text being overwritten with random characters, then shredded. | Going back to that book: this doesn't just cross out the index entry. It scribbles over every letter on the page first. |
| Cut to **Erase a drive** screen. Select the USB drive, show the **Dry run** checkbox ticked. | For a whole drive, there's a full-device wipe — and a dry run, so you can see the entire process work safely before you commit. |
| Untick dry run, type the device path, run it. Progress bar. | The real thing overwrites every single byte on the drive with an AES-256 random keystream in one pass — the Clear method defined in NIST Special Publication 800-88. |
| Green completion panel + audit log path. | Every run is written to an append-only audit log. |

---

## Section 8 — Proof (4:10 – 4:35)

| On screen | Narration |
|---|---|
| Click **Generate signed certificate**. The certificate panel fills in: ID, timestamp, device, method, standard. | And this is the part that matters most for asset disposal. |
| Highlight the **Ed25519 signature** and **key fingerprint**. | SHUNYA issues a certificate, signed with an Ed25519 cryptographic key. |
| Click **Verify certificate** → green **"Authentic"**. | It verifies right here as authentic. |
| Open the saved certificate HTML, change one character in a text editor, re-verify → red **"Tampered"**. | Now change one character — a single digit in the serial number — and verification fails instantly. |
| Back to green. | You can't forge it, you can't quietly edit it, and anyone can check it offline without trusting us. That's the difference between *saying* a drive was wiped and *proving* it. |

---

## Section 9 — Close (4:35 – 5:00)

| On screen | Narration |
|---|---|
| Split screen: recovery results on the left, signed erasure certificate on the right. | Two halves of the same lifecycle. Bring data back when it's evidence. Destroy it beyond recovery when it's a liability. |
| Text builds line by line: **Offline** · **Read-only by design** · **Signed proof** · **One tool** | One tool. Completely offline. The original never written to. And a signed, verifiable record of whatever you did. |
| Logo + tagline. | SHUNYA. Recover what matters. Destroy what shouldn't remain. |

---

## Verified claims you can put on screen

Every figure below is real and demonstrable on camera. Use them as stat cards.

| Claim | Detail |
|---|---|
| **30+ file formats, 6 families** | Images, documents, archives, audio/video, databases, executables — selectable per job |
| **Structure-aware carving** | Files bounded by their own internal structure, not a guessed length |
| **SHA-256 chain of custody** | Source fingerprinted before and after; every exported file verified |
| **Real malware scanning** | YARA-X engine; flagged files quarantined and never previewed |
| **NIST SP 800-88 Rev. 2** | AES-256-CTR CSPRNG overwrite, the Clear method |
| **Ed25519 signed certificates** | Tamper-evident; verifiable offline by any third party |
| **System-disk protection** | The running OS drive can never be selected for erasure |
| **100% offline** | No network calls, no telemetry, no auto-update |
| **Cross-platform core** | Rust engine with Windows and Linux implementations |

---

## Recording checklist

1. **Prepare the drive.** Copy 10–12 realistic files onto the USB drive, delete them, then run `node tools/demo/make-demo-image.mjs` for a known-good image containing one EICAR test file (the industry-standard harmless malware test file) so the red threat badge appears on cue.
2. **Set the scene.** Light theme, 1920×1080, 125% display scaling so text is readable on a phone. Close every other window.
3. **Record screen and voice separately.** Screen first with no talking, voice second while watching the footage. It is far easier to match a calm voice to fast footage than the reverse.
4. **Speed up the waits.** Record the scan and wipe at real speed, then play them at 4–8× with a subtle whoosh. Never cut them out entirely — judges want to see it actually running.
5. **Hold on the good moments.** Three full seconds on the red threat badge, the green "Authentic", and the red "Tampered". Those are the shots people remember.
6. **Subtitles.** Burn them in. Most judges watch the first pass muted.
7. **Do the tamper demo live.** Editing the certificate in Notepad on camera and watching verification fail is the single most convincing five seconds in the video.

---

## 60-second cut-down (for social or a lightning round)

> Deleting a file doesn't erase it — it just removes the name. That's a problem twice over: investigators can't get evidence back easily, and retired hardware leaks data for years.
>
> SHUNYA does both halves. It makes a read-only forensic copy of a drive, then finds deleted files by their structure rather than their names — photos, documents, databases, video — across thirty-plus formats. It checks each one is whole, scans it for malware, and exports it with a verified hash.
>
> Then flip it around: point SHUNYA at a drive you're retiring, and it overwrites every byte with cryptographic random data to the NIST 800-88 standard — and issues a certificate signed with an Ed25519 key. Change one character of that certificate and verification fails.
>
> Completely offline. The original is never written to. Recover what matters, destroy what shouldn't remain.
