# SHUNYA — SIH Demo Kit  🎯

**Read this first.** Everything you need for tomorrow's presentation is in this folder.
The demo is split into two independent parts:

- **Part A — Retrieval / Recovery** → *you* present. (SIH PS **26149**, read‑only recovery)
- **Part B — Secure Deletion / Drive Eraser** → *your friend* presents. (Secure Data Wiping, NIST SP 800‑88)

> One‑line story that ties it together (say this in the intro):
> **"Deleting a file doesn't destroy it — we prove that by recovering it. And when data *must* be destroyed for safe disposal, we destroy it properly and provably. Two sides of the digital‑evidence lifecycle, in one platform."**

---

## What's in this folder

| File | Use it for |
|---|---|
| `00_START_HERE.md` | This master guide + setup + pre‑demo checklist |
| `01_RETRIEVAL_DEMO.md` | Part A — your click‑by‑click script + narration |
| `02_DELETION_DEMO.md` | Part B — your friend's click‑by‑click script + narration |
| `03_JUDGE_QA.md` | Likely judge questions + confident answers (**read this twice**) |
| `04_PITCH_AND_UNIQUENESS.md` | The 60‑second pitch, why it's unique, PS alignment |
| `05_TECH_DEEP_DIVE.md` | Deeper technical answers if judges probe |
| `assets/demo_evidence.raw` | The prepared evidence image for the retrieval demo |
| `LAUNCH_APP.bat` | Double‑click to open the app (normal mode, for retrieval) |
| `LAUNCH_APP_ADMIN.bat` | Open the app **as Administrator** (needed for a live device wipe) |

---

## Setup (do this once, on this laptop)

**1. The app (the only `.exe` you run):**
```
apps\desktop\out\SIH Recovery Platform-win32-x64\recovery-platform.exe
```
Double‑click `LAUNCH_APP.bat` in this folder — it opens exactly that app. It is self‑contained (the Rust recovery engine is bundled inside).

**2. The evidence image** for retrieval is already prepared at `assets\demo_evidence.raw` (4 MB, contains 7 recoverable images, one carrying a harmless malware **test** signature). You can regenerate it any time with `node tools\demo\make-demo-image.mjs`.

**3. The pendrive** for the deletion part: your SanDisk Ultra (28.6 GB). Put a few throwaway files on it before the demo so you can *show* them, then wipe. **Back up anything you care about — the wipe is irreversible.**

---

## ✅ Pre‑demo checklist (rehearse the morning of)

- [ ] Laptop charged + charger in bag. Screen mirroring tested on the venue projector.
- [ ] `LAUNCH_APP.bat` opens the app cleanly (do a full retrieval run once — see `01_RETRIEVAL_DEMO.md`).
- [ ] Confirm the retrieval recovers **7 files** and flags **1 threat** (that's the known‑good result).
- [ ] Pendrive plugged in; a couple of dummy files copied onto it; **backup done**.
- [ ] Decide with your friend: live pendrive **wipe** on stage, or the safe **dry‑run**? (Both are in `02_DELETION_DEMO.md`. Dry‑run is zero‑risk and still visually convincing.)
- [ ] Both of you have read `03_JUDGE_QA.md`.
- [ ] Close Slack/notifications; full‑screen the app; increase display scaling so judges can read it.

---

## The 30‑second flow on stage

1. **Intro (either of you):** the one‑line story above + the problem (30s).
2. **Part A – Retrieval (you):** recover "deleted" files from the evidence image; show hashes; **YARA‑X flags a malicious file**; export verified + report. (~2 min)
3. **Part B – Deletion (friend):** securely wipe the pendrive with a CSPRNG overwrite (NIST 800‑88 *Clear*); show the audit log. (~2 min)
4. **Close:** "Recovery for investigation, sanitization for safe disposal — standards‑aligned, offline, and honest about its limits." + Q&A.

Good luck — you've got a real, working, standards‑literate tool. Own it. 🚀
