# Part A — Retrieval / Recovery Demo  (YOU present, manually)

**Goal:** show that "deleted" files are recoverable, with a full chain of custody, that a **malicious** file among them is detected, and finish with a **cryptographically signed recovery certificate**.

**Time:** ~2.5 min. **Admin needed:** No.

---

## How recovery actually works (so you present it accurately)

SHUNYA recovers from a **RAW disk image** (`.raw` / `.dd`) by **signature carving** — it finds file content sitting in unallocated ("deleted") space. It does **not** undelete from a live Windows folder. So you present it with a `.raw` image that contains the deleted files. Two ways to get one:

- **Easiest / reliable (recommended):** use the included **`assets\demo_evidence.raw`** — a ready‑made image with **7 recoverable images**, one carrying a harmless **EICAR** malware test signature. Known‑good result: **7 recovered, 1 flagged as a threat.**
- **Most convincing "we deleted it and got it back" (optional, prepare beforehand):** plug in a small USB, copy a few photos, **delete them + empty the Recycle Bin**, then image the USB **read‑only** to a `.raw`/`.dd` file with a free imager like **FTK Imager** (`File → Create Disk Image → Raw (dd)`). On stage, add that image and recover the photos you just "lost."

> Say it honestly if asked: *"We work on a forensic image so the original device is never touched — that's the read‑only chain of custody. The image holds the deleted files in unallocated space; we carve them back."*

---

## The script (do + say)

**1. Frame the problem** *(say)*
> "When you delete a file and empty the bin, the data isn't gone — the space is just marked reusable. For an investigator that's evidence; for anyone disposing of a device, it's a leak. Watch."

**2. Open the app + create the case** *(do)*
- Double‑click **`recovery-platform.exe`** (or your desktop shortcut).
- Click **New recovery** → **Case title:** `Seized Laptop — Case 26149` · **Operator:** your name.
- **Continue to workspace** → **Choose parent folder** → pick a new empty folder → **Continue to review** → **Create case**.

> *(say)* "Every action is logged against a case number and an operator — chain of custody from click one."

**3. Add the evidence (read‑only)** *(do)*
- Open **Recovery** (or **Sources**) in the left sidebar.
- In **Disk image path**, type/paste the path to your image (the included `...\SIH_DEMO_KIT\assets\demo_evidence.raw`, or your own) → **Add image source**.
- Wait for the green **Ready** badge.

> *(say)* "Opened strictly **read‑only** — we never write to evidence. A safety assessment ran automatically."

**4. Choose the goal + run — THE WOW MOMENT** *(do)*
- **Choose recovery goal** → **Recover everything** (Recommended) → **Continue to scan options**.
- On **Full Scan**, click **Use this preset**. The app jumps to the **live recovery view** — point at the animated progress bar, the pulsing stage, the elapsed timer, and the streaming event feed.

> *(say)* "The engine actually working — partition discovery, carving, validation, **threat scanning**, indexing. Real stages, real progress."

**5. Show the recovered files** *(do)*
- Open **Recovered Files**. You'll see the recovered images, each with a **SHA‑256** hash. At the top, a red **"1 potential threat"** summary.

> *(say)* "Files an investigator would have lost — back, each fingerprinted with SHA‑256 so it's tamper‑evident in court."

**6. THE SECOND WOW — threat detection** *(do)*
- Click the file marked **Potentially unsafe**. Show the blocked preview ("Potentially unsafe content detected").

> *(say)* "One recovered file carries a **malware signature** — our **YARA‑X** engine caught it and quarantined it. Recovered content is never auto‑opened. We recover evidence *and* protect the investigator."

**7. Verified export + report** *(do)*
- **Exports** → export to a **different folder** (it refuses same‑device); every file is **re‑hashed and verified**.
- **Reports** → **Generate report** → show the JSON/Markdown report + the honest limitations.

**8. THE FINALE — signed certificate** *(do)*
- On the **Reports** screen, click **Generate signed certificate** → a **tamper‑evident certificate** appears (Ed25519 signature + key fingerprint).
- Click **Verify certificate** → it shows **Authentic ✓**.
- *(Optional, strong)* Open the **online verifier** (link in `00`/`06`), paste the certificate → it says **Authentic** independently; the **Tamper** button flips it to **Tampered ✗** live.
- *(Optional)* Click **Save certificate (.html)** and mention you can print it to PDF.

> *(say)* "And we seal the result with an **Ed25519‑signed certificate**. Change one character and verification fails — it can be checked by anyone, offline. Over to [friend]."

---

## If something goes wrong (stay calm)
- **App won't open** → run the dev app: in a terminal in the repo, `pnpm --filter @recovery/desktop start`.
- **"DAEMON_UNAVAILABLE"** → use the dev app fallback above.
- **No files recovered** → make sure you pointed at the `.raw` image path correctly; use the included `demo_evidence.raw`.
- If asked for a feature that isn't there, say *"that's on our roadmap; today we ship the honest, working slice"* and point at the report's limitations. Honesty wins.
