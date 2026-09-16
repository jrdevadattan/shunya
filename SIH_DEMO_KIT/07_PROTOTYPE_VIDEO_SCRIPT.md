# Prototype Video Script — SHUNYA

**Problem Statement 149 · National Technical Research Organisation (NTRO)**
*Design and Development of an Integrated Secure Data Erasure and Advanced File Recovery Tool for Digital Forensics and Data Sanitization*

**Runtime:** 15:40 · **Narration:** 2,067 words, written out word for word · **Voice:** one narrator, calm and confident

---

## How to use this script

Everything in a **grey quote block** is what **you say, word for word**. Read it exactly as written — it has been written for the ear, with short sentences and natural phrasing.

Everything under **ON SCREEN** is what the viewer sees at that moment.

**DIRECTOR'S NOTE** lines are for you, never spoken.

Speak at about 145 words a minute. That is slower than normal conversation. If it feels slightly too slow while recording, it is correct.

---

### Say these words correctly

| Word | Say it as |
|---|---|
| SHUNYA | SHOON-ya |
| NIST | "nist" (one syllable) |
| SHA-256 | "shaw two-fifty-six" |
| Ed25519 | "E-D two-five-five-one-nine" |
| YARA | "YAR-ah" |
| EICAR | "EYE-car" |
| Carving | say it, then immediately explain it — never assume they know |

---

# PART 1 — THE PROBLEM (0:00 – 1:37)

### Shot 1 · Cold open

**ON SCREEN:** Black screen. White text fades in, one line at a time: **"Delete."** … **"Empty Recycle Bin."** … **"Format the drive."** Then all three are struck through with a red line.

> Delete the file. Empty the recycle bin. Even format the whole drive.
>
> And the data is still there.

**DIRECTOR'S NOTE:** Pause for a full second after "still there." Let it land.

---

### Shot 2 · The book analogy

**ON SCREEN:** Simple animation of a book. Camera on the index page. One entry gets struck through. Camera then flips to the actual page in the middle of the book — the text is completely intact.

> Here is what actually happens when you delete something.
>
> Think of your hard drive as a book with an index at the front. When you delete a file, the computer crosses out its name in the index. That's all it does. It does not go and tear out the page.
>
> The page is still in the book. Every word still on it. It stays there until something else happens to be written over the top of it — which might be tomorrow, or might be never.

---

### Shot 3 · Two problems, one cause

**ON SCREEN:** Split screen. Left: an evidence bag with a phone and a hard drive. Right: a warehouse of retired office laptops on pallets.

> And that one fact creates two completely different problems, for two completely different people.
>
> On this side, a digital forensics investigator. A suspect has deleted the files that matter. Those files are still physically on the disk, and the investigator's entire case depends on getting them back — and on proving, later in court, that nothing was altered while doing it.
>
> On this side, an organisation retiring a thousand laptops. Every one of those drives still holds years of data that somebody believed was deleted. Hand them to a recycler and you have handed away your data.
>
> Same fact. Opposite needs. And until now, two completely separate sets of tools.

---

# PART 2 — INTRODUCING SHUNYA (1:37 – 2:46)

### Shot 4 · Logo and pitch

**ON SCREEN:** Logo animates in — **SHUNYA** — with the tagline **"Recover what matters. Destroy what shouldn't remain."**

> We built one tool that does both. It's called SHUNYA.
>
> SHUNYA brings deleted files back when you need them as evidence. And it destroys data beyond recovery when it must never be seen again. Whichever one you do, it gives you a signed certificate that proves you did it.

---

### Shot 5 · The home screen

**ON SCREEN:** The app opens. Home screen with three large cards: **Recover files**, **Securely delete**, **Make a disk image**. Cursor moves across them slowly without clicking.

> And this is the entire product, on one screen.
>
> Recover files. Securely delete. Or make a forensic copy of a drive before you touch it.
>
> We designed it this way deliberately. Forensic software has a reputation for being impossible to use — walls of settings, jargon everywhere, and one wrong click destroys your evidence. A trained examiner can handle that. A police constable at a district cyber cell, at eleven at night, cannot.
>
> So in SHUNYA, the simple path is the visible path. Everything technical still exists — it just sits one click away, under Advanced options, where it can't intimidate anybody.

---

# PART 3 — THE SAFETY FOUNDATION (2:46 – 3:39)

### Shot 6 · Read-only

**ON SCREEN:** Zoom slowly onto the green badge in the bottom-left of the sidebar: **"Source writes blocked."**

> Before anything else, look at the bottom-left corner. That green badge is on every single screen in this application, and it never turns off.
>
> It means the evidence drive is opened read-only. SHUNYA can read from it. SHUNYA cannot write to it. Not by accident, not by a mis-click, not by any setting a user could change — because there is no setting. The ability to write to your source was never built.
>
> In forensics this is everything. If you modify the evidence, the evidence is worthless. So we made it structurally impossible.

**ON SCREEN:** Cut to an icon row: a crossed-out cloud, a crossed-out Wi-Fi symbol, a crossed-out account avatar.

> And the whole tool runs completely offline. No cloud, no account, no telemetry. Nothing you recover ever leaves the machine it was recovered on.

---

# PART 4 — STEP ONE: COPY THE DRIVE (3:39 – 5:16)

### Shot 7 · Device selection

**ON SCREEN:** Click **Make a disk image**. The device list loads. The internal NVMe drive is greyed out with a green badge reading **"System disk — protected."** The SanDisk USB drive is selectable, badged **"Removable."**

> First, proper forensic practice. You never work on the original drive. You work on a copy.
>
> SHUNYA lists the drives it can see — and notice the first one. That's the computer's own system drive, and it is greyed out and protected. You couldn't select it if you tried. A tired operator at the end of a long shift cannot accidentally image or wipe the machine they're standing at.

---

### Shot 8 · Capturing

**ON SCREEN:** Select the USB drive. Choose **Entire drive**. Pick a save location. Click **Copy**. The progress bar runs. Speed the footage to 6× with a subtle whoosh.

> We select the USB drive, choose where to save, and press copy.
>
> SHUNYA now reads that drive sector by sector — not file by file — into a single image file. That distinction matters. A file-by-file copy only copies files that still exist. A sector-by-sector copy takes everything, including all the space where deleted files are still sitting.

---

### Shot 9 · The fingerprint

**ON SCREEN:** The result panel appears. Highlight the **SHA-256** hash. Let the camera rest on it.

> And as it reads, it is calculating this: a SHA-256 hash.
>
> Think of it as a fingerprint for the entire image — sixty-four characters produced from every byte of data. Change one single bit anywhere in that image, and this fingerprint changes completely and visibly.
>
> That is how you prove, months later in a courtroom, that the copy you analysed is identical to the drive you seized. From this point on we work only on the copy. The original goes back into the evidence bag, untouched.

---

# PART 5 — OPENING A CASE (5:16 – 5:58)

### Shot 10 · Case creation

**ON SCREEN:** Home → **Recover files**. The new case form. Type the title "Q4 workstation recovery" and the operator name "Priya Nair." Show the **More details** section expanding briefly to reveal reference number, organisation and notes, then collapse it. Click **Create case**.

> Now the recovery itself. And every recovery in SHUNYA begins as a case.
>
> A title, so you know what this is. The name of whoever is running it, because accountability matters. And a folder, where every recovered file, every log and every report will be kept together.
>
> There's a reference number and an organisation field too, for anyone filing this against a formal case docket — but they're optional, so they stay tucked away under "More details."
>
> This is the chain of custody, and it starts before a single byte is read.

---

# PART 6 — CHOOSING WHAT TO RECOVER (5:58 – 7:05)

### Shot 11 · The source check

**ON SCREEN:** Select the `.raw` image file → **Continue**. The set-up screen loads with a green tick and the words **"Source is ready."**

> We point it at the image we just made, and SHUNYA checks it before doing anything — that it can be read, that it's intact, and that it will be opened read-only. Green tick. Source is ready.

---

### Shot 12 · File families

**ON SCREEN:** Camera settles on the six file-family cards: Images, Documents, Archives, Audio & video, Databases, Executables — all six ticked. Untick two, watch the counter fall, tick them again.

> And now the only real decision the user has to make. What are you looking for?
>
> Photos and images. Documents — PDFs, Word files, spreadsheets, presentations. Compressed archives. Audio and video. Databases. And programs.
>
> Six families, covering more than thirty individual file formats. Tick what you need and leave the rest — if you're only after photographs, there's no reason to spend an hour scanning for video files.

---

### Shot 13 · Advanced options

**ON SCREEN:** Expand **Advanced options** to reveal recovery goal and scan depth. Hold two seconds. Collapse it again. Then click the orange **Start recovery** button.

> Everything else has a safe, sensible default. Scan depth, recovery strategy — all of it is here under Advanced options for the specialist who wants it, and completely out of the way for the person who doesn't.
>
> Then you press one button.

---

# PART 7 — HOW IT ACTUALLY WORKS (7:05 – 9:33)

### Shot 14 · The core idea

**ON SCREEN:** Live job screen running in the background, blurred. Over it, an animation: a long grey bar representing raw disk bytes scrolling past.

> So what is it actually doing? This is the heart of the whole project, and it's genuinely clever.
>
> Remember, the file names are gone. The index entries were crossed out. So SHUNYA does not look for names. It reads the raw disk from beginning to end and looks for *shapes*.

---

### Shot 15 · Signatures

**ON SCREEN:** A small block in the grey bar lights up orange. Zoom in to reveal the bytes `FF D8 FF` at its start.

> Every file format on earth begins with a signature — a distinctive pattern in its first few bytes.
>
> Every JPEG photograph ever created starts with the same three bytes. So does every PDF. Every Word document, every SQLite database, every MP4 video — each one has its own unmistakable opening.
>
> It's like recognising a song from its first three notes, without ever being told the title. SHUNYA scans the entire drive listening for those opening notes.

---

### Shot 16 · The hard part

**ON SCREEN:** The highlighted block tries to extend and stops short — a red X. Then the animation walks forward through internal structure markers, ticking along, until it lands precisely on the true end of the file with a green tick.

> But finding where a file *starts* is the easy part. The real problem is knowing where it *ends*.
>
> Get that wrong and you recover a corrupted, unopenable fragment. Most basic recovery tools simply guess — they grab a fixed amount of data and hope.
>
> SHUNYA doesn't guess. It reads the file's own internal structure and follows it to the exact final byte. In a PNG image, it walks the chunk table. In an MP4 video, it walks the list of boxes. In a Word document, it finds the central directory. In a database, it reads the page count from the header and multiplies.
>
> To stay with the music: it doesn't just recognise the opening notes, it follows the melody all the way to the last bar. That is the difference between a photo that opens and a photo that doesn't.

---

### Shot 17 · Checking and scanning

**ON SCREEN:** The stage strip on the live screen advances: Recover → Validate → Threat scan → Index.

> Then every single file it pulls out goes through two more stages.
>
> First, validation. SHUNYA re-opens the recovered file and confirms it's structurally complete, and tells you honestly if it's only partial.
>
> Second — and this one matters more than people expect — a malware scan, using the real YARA engine, before you are ever allowed near the file.

---

# PART 8 — THE RESULTS (9:33 – 11:35)

### Shot 18 · What came back

**ON SCREEN:** **Recovery completed.** Click **Review recovered files.** The results table fills with JPEGs, a PNG, a GIF, a PDF, a DOCX, a SQLite database, a WAV, a ZIP.

> Twelve files recovered. Photographs, a PDF report, a Word document, a database, an audio recording, an archive — all of it pulled back from a drive where every one of them had been deleted.

---

### Shot 19 · Filtering and provenance

**ON SCREEN:** Click file-type filters in the left rail; the table narrows and widens. Then click one recovered JPEG; the right panel shows its SHA-256 and byte offset.

> You can filter by type, search by name, and open any file to inspect it.
>
> And for each one, SHUNYA records its fingerprint and the exact byte offset it was carved from — the precise physical location on the original disk where this file was found. That's what ties a recovered photograph back to a specific drive, defensibly.

---

### Shot 20 · The flagged file

**ON SCREEN:** Click the file with the red **"Potential threat"** badge. The preview panel shows it is blocked. Hold this shot for three full seconds.

> And here is the one we really care about.
>
> One of these recovered files matched a known malware signature. SHUNYA flagged it in red, quarantined it, and flatly refuses to preview or open it.
>
> Think about why that matters. You are recovering data from a machine that may well have been compromised — that could be the entire reason it's under investigation. The very last thing that should happen is that the investigator's own computer gets infected by the evidence. So dangerous files are identified and contained automatically, before anyone can click them.

---

### Shot 21 · Export and report

**ON SCREEN:** Tick several files → **Review export** → choose a destination folder → **Start verified export.** Green success panel. Then the **Report** screen with the JSON and Markdown files listed.

> Getting the files out is just as careful. Every copied file is hashed and checked against the original, so you know the export is faithful. And SHUNYA refuses to write onto the same drive it's reading from — you cannot accidentally export your evidence on top of your evidence.
>
> Finally, the case report writes itself. A machine-readable record for verification, and a readable summary for a human — both generated from what actually happened during the job, not typed up afterwards from memory.

---

# PART 9 — THE OTHER HALF: DESTROYING DATA (11:35 – 13:23)

### Shot 22 · Flipping the problem

**ON SCREEN:** Home → **Securely delete.**

> Now turn the whole problem around. Same tool, same home screen, second card.

---

### Shot 23 · Planning a deletion

**ON SCREEN:** Choose a folder on the USB drive. The plan appears: device model, file count, total size, and a preview list of the files that will be destroyed.

> Say a drive is being retired, or a folder legally has to be destroyed.
>
> You point SHUNYA at it — and before it touches a single byte, it shows you exactly what will be destroyed. Which drive, how many files, how much data, and a preview of the files themselves. No surprises.

---

### Shot 24 · Confirmation

**ON SCREEN:** The red confirmation box. Type the full folder path by hand. The delete button turns from disabled to enabled.

> To actually go ahead, you type the full path by hand. Not a checkbox, not an OK button — you type it. Destroying data permanently should take deliberate effort.

---

### Shot 25 · The overwrite

**ON SCREEN:** Click delete. Progress runs. Cut to an animation: a page of readable text being overwritten character by character with random symbols, then removed entirely.

> And now, file by file, SHUNYA overwrites the contents with cryptographically random data, shortens the file to nothing, renames it, and removes it.
>
> Back to our book. This doesn't just cross out the index entry. It scribbles over every letter on the page first, then tears the page out, then burns it.

---

### Shot 26 · Whole-drive erasure

**ON SCREEN:** Cut to the **Erase a drive** screen. Select the USB drive. Show the **Dry run** checkbox ticked, then untick it, type the device path, and run. Progress bar at 6× speed.

> For an entire drive there's a full-device wipe. And notice this checkbox — dry run. It runs the complete process safely, so an operator can watch exactly what will happen before committing to something irreversible. We think every destructive tool should have this.
>
> The real run overwrites every single byte on that drive with an AES-256 random keystream, in one continuous pass. That is the "Clear" method defined in NIST Special Publication 800-88 — the international standard for media sanitization.
>
> And every run, real or dry, is written into an append-only audit log.

---

# PART 10 — PROOF (13:23 – 14:23)

### Shot 27 · The certificate

**ON SCREEN:** Click **Generate signed certificate.** The panel fills: certificate ID, timestamp, device model, serial, method, standard.

> And now the part that matters most for asset disposal, and the part we're proudest of.
>
> Anyone can claim a drive was wiped. SHUNYA proves it.

**ON SCREEN:** Highlight the **Ed25519 signature** and the **key fingerprint**.

> It issues a certificate recording what was destroyed, how, when, and to which standard — and signs it with an Ed25519 cryptographic key.

---

### Shot 28 · The tamper demo

**ON SCREEN:** Click **Verify certificate** → green **"Authentic."** Then open the saved certificate file in Notepad, change one character of the serial number, save, and verify again → red **"Tampered."** Then restore it → green again.

> Watch this. Verify — authentic.
>
> Now I'll open that certificate and change one single character. One digit of the serial number. Save it. Verify again.
>
> Tampered. Immediately, and unmistakably.
>
> You cannot forge this certificate, you cannot quietly edit it, and anybody can check it themselves, offline, without having to trust us or our software. For an organisation disposing of hardware, that is the difference between *saying* the data was destroyed and *proving* it — to an auditor, a regulator, or a court.

**DIRECTOR'S NOTE:** Do this live on camera in one unbroken take. It is the single most convincing moment in the video.

---

# PART 11 — UNDER THE HOOD (14:23 – 15:10)

### Shot 29 · Architecture

**ON SCREEN:** A clean architecture diagram: **Interface (Electron + React)** on top, **Recovery engine (Rust)** below it, and beneath that three boxes — **Carving**, **Validation**, **Threat scan** — with the evidence drive at the bottom behind a one-way arrow labelled **READ ONLY**.

> Very briefly, for the engineers watching.
>
> The interface is Electron and React. The engine underneath — the part that does the carving, the validation and the erasure — is written in Rust, chosen for memory safety, because a crash while handling evidence is not acceptable.
>
> The two halves talk over a strict, typed boundary. The interface can only ask for things the engine actually supports, and it only ever displays what the engine truthfully reports. Nothing on screen is estimated or invented.
>
> The results index is SQLite, and it has been tested against a million recovered files. It works on Windows and on Linux.

---

# PART 12 — CLOSE (15:10 – 15:40)

### Shot 30 · The two halves together

**ON SCREEN:** Split screen. Left: the recovery results table. Right: the green "Authentic" certificate.

> Two halves of one lifecycle, in one tool.
>
> Bring data back when it's evidence. Destroy it beyond recovery when it's a liability. And walk away with signed proof of whichever one you did.

---

### Shot 31 · Final card

**ON SCREEN:** Text builds one line at a time: **Completely offline** · **Read-only by design** · **Signed, verifiable proof** · **Built for people who aren't specialists**. Then the logo and tagline.

> Completely offline. Read-only by design. Signed proof at the end of every job. And simple enough that it doesn't need a specialist to operate it.
>
> SHUNYA. Recover what matters. Destroy what shouldn't remain.

**DIRECTOR'S NOTE:** Hold the final logo card for three seconds of silence before cutting to black.

---

# Verified claims for on-screen stat cards

Every figure here is real and demonstrable on camera.

| Claim | Detail |
|---|---|
| **30+ formats, 6 families** | Images, documents, archives, audio/video, databases, executables — chosen per job |
| **Structure-aware carving** | Files bounded by their own internal structure, not a guessed length |
| **SHA-256 chain of custody** | Source fingerprinted before and after; every exported file verified |
| **Real malware scanning** | YARA engine; flagged files quarantined and never previewed |
| **NIST SP 800-88 Rev. 2** | AES-256-CTR random overwrite — the Clear method |
| **Ed25519 signed certificates** | Tamper-evident and verifiable offline by any third party |
| **System-disk protection** | The running OS drive can never be selected for erasure |
| **Dry-run mode** | Rehearse a destructive operation safely before committing |
| **Append-only audit log** | Every erasure run recorded |
| **100% offline** | No network calls, no telemetry, no accounts |
| **Rust engine** | Memory-safe core; Windows and Linux |
| **Scale-tested** | Result index exercised with one million recovered files |

---

# Recording checklist

1. **Prepare the drive.** Run `node tools/demo/make-demo-image.mjs` to build a known-good evidence image containing twelve real, openable files across eight formats — one of which carries the EICAR test signature, the industry-standard harmless malware test file, so the red threat badge appears exactly on cue.
2. **Set the scene.** Light theme. 1920×1080. Display scaling at 125% so text stays readable on a phone. Close every other window and notification.
3. **Record picture and sound separately.** Capture the screen silently first, then record the narration while watching the footage back. Matching a calm voice to fast footage is far easier than the reverse.
4. **Speed up the waiting.** Record scans and wipes at real speed, then play them at 4–8× with a soft whoosh. Never cut them out completely — judges want to see it genuinely running.
5. **Hold the three money shots.** Three full seconds each on the red threat badge, the green "Authentic," and the red "Tampered."
6. **Burn in subtitles.** Most people watch the first pass with the sound off.
7. **Do the tamper demo in one take.** No cuts. That is what makes it believable.

---

# If there is a time limit

This full script runs about fifteen minutes, which is right for a detailed technical walkthrough or a demo you present in person. If the submission portal caps the video, record everything anyway and cut down — you will want the extra footage.

**Five-minute cut.** Keep shots 1, 2, 3, 4, 5, 6, 7, 9, 12, 13, 15, 16, 17, 18, 20, 21, 23, 26, 27, 28, 31. Drop Part 5 (opening a case), Part 11 (architecture), and the slower explanatory beats. Trim each remaining narration block to its first two sentences.

**Three-minute cut.** Keep shots 1, 2, 4, 6, 12, 15, 16, 20, 25, 27, 28, 31.

That shortest version still carries the whole argument: the hook, the idea, the safety guarantee, the clever part, the malware catch, the destruction, and the proof.

---

# 60-second elevator version

> Deleting a file doesn't erase it. It just removes the name from an index — the data stays on the disk for months or years. That's a problem twice over: investigators struggle to recover evidence, and retired hardware leaks data long after anyone thought it was gone.
>
> SHUNYA solves both. It makes a read-only forensic copy of a drive, then finds deleted files by their structure rather than their names — photos, documents, databases, video, across more than thirty formats. It confirms each file is complete, scans it for malware, and exports it with verified hashes.
>
> Then flip it around. Point SHUNYA at a drive you're retiring and it overwrites every byte with cryptographic random data, to the NIST 800-88 standard, and issues a certificate signed with an Ed25519 key. Change one character of that certificate and verification fails instantly.
>
> Completely offline. The original is never written to. Recover what matters — destroy what shouldn't remain.
