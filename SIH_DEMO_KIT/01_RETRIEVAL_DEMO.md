# Part A — Retrieval / Recovery Demo  (YOU present)

**Goal:** show that "deleted" files are recoverable, with a full chain of custody, and that the tool even **detects a malicious file** among the recovered data.

**Time:** ~2–3 minutes. **Admin needed:** No.

> The evidence image `assets\demo_evidence.raw` simulates a 4 MB drive with **7 deleted photos** sitting in unallocated space. One of them carries the **EICAR** signature — the industry‑standard *harmless* test string that every antivirus recognises. This proves real threat detection without touching real malware.

**Known‑good result (memorise this):** the tool recovers **7 files**, all validated with SHA‑256, and **YARA‑X flags exactly 1** ("Recovered JPEG 0000005") as *Potentially unsafe*.

---

## Setup (before you start speaking)
1. Double‑click **`LAUNCH_APP.bat`** → the SHUNYA window opens on "Your recovery cases".
2. Have the evidence image path on your clipboard:
   `C:\Users\J R Deva Dattan\Desktop\sih\SIH_DEMO_KIT\assets\demo_evidence.raw`

---

## The script (do + say)

**1. Frame the problem** *(say)*
> "When you delete a file and empty the recycle bin, the data isn't gone — the space is just marked reusable. For an investigator that's an opportunity; for anyone disposing of a device, it's a data‑leak risk. Let me show you both."

**2. Create the case** *(do)*
- Click **New recovery** (top‑right).
- **Case title:** `Seized Laptop — Case 26149`  ·  **Operator:** your name.
- **Continue to workspace** → **Choose parent folder** → pick an empty folder (e.g., a new `Desktop\demo-case`).
- **Continue to review** → **Create case**.

> *(say)* "Every action is logged against a case number and an operator — chain of custody from the first click."

**3. Add the evidence (read‑only)** *(do)*
- In the case, open **Recovery** (or **Sources**) in the left sidebar.
- Paste the image path into **Disk image path** → click **Add image source**.
- Wait for the green **Ready** badge.

> *(say)* "The source is opened **strictly read‑only** — we never write to the evidence. Notice the safety assessment ran automatically."

**4. Choose the goal** *(do)*
- Click **Choose recovery goal** → select **Recover everything** (marked **Recommended**) → **Continue to scan options**.

> *(say)* "We're honest in the UI — goals that need a metadata engine we don't ship are clearly marked 'not in this build'. No overclaiming."

**5. Run the scan — THE WOW MOMENT** *(do)*
- On **Full Scan**, click **Use this preset**. The app jumps to the **live recovery view**.
- **Point at the screen** while it runs: the animated progress bar, the pulsing active stage, the elapsed timer, and the **live event feed** streaming each stage.

> *(say)* "This is the engine actually working — partition discovery, signature carving, validation, **threat scanning**, indexing. Real stages, real progress, not a fake spinner."

**6. Show the recovered files** *(do)*
- Open **Recovered Files** (Results). You'll see **7 recovered images**, each with a **SHA‑256** hash and a validation state.

> *(say)* "Seven files an investigator would have lost — back. Each one fingerprinted with SHA‑256 so it's tamper‑evident in court."

**7. THE SECOND WOW — threat detection** *(do)*
- Find **Recovered JPEG 0000005**, marked **Potentially unsafe**. Click it.
- Show that the **preview is blocked** and it's flagged by the threat scanner.

> *(say)* "One of the recovered files carries a **malware signature**. Our **YARA‑X** engine caught it and quarantined it — recovered content is *never* auto‑opened. So we recover evidence **and** protect the investigator. That's unique."

**8. Verified export + report** *(do)*
- Open **Exports** → export the results to a **different folder** (the tool refuses same‑device export). Every exported file is **re‑hashed and verified**.
- Open **Reports** → **Generate report**. Show the JSON/Markdown report: the tools used (**yara‑x** is listed), method counts, and the **honest limitations** section.

> *(say)* "Exports are verified byte‑for‑byte, and the report states exactly what we did and what we *couldn't* do — a judge can trust it because it doesn't hide its limits."

**9. Hand over** *(say)*
> "So — deleted data is recoverable. Which is exactly why secure destruction matters. Over to [friend] for the other half."

---

## If something goes wrong (calm recovery)
- **App won't open** → run the dev app instead: open a terminal in the repo and run `pnpm --filter @recovery/desktop start`.
- **"DAEMON_UNAVAILABLE"** → the bundled engine didn't start; use the dev app fallback above.
- **Fewer/for than 7 files** → re‑generate the image: `node tools\demo\make-demo-image.mjs`, then re‑add the source.
- **Never** improvise a feature that isn't there. If asked for something unsupported, say "that's on our roadmap — today we ship the honest, working slice," and point to the limitations in the report. Judges reward honesty.
