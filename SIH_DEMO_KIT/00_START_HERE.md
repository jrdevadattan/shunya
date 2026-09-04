# SHUNYA — SIH Demo Kit  🎯

**Read this first.** This kit is documentation + assets you use to run the demo **manually** on stage — there are no scripts to run. You click through the real app yourself.

Two independent parts:
- **Part A — Retrieval / Recovery** → *you* present. (SIH PS **26149**, read‑only recovery)
- **Part B — Secure Deletion / Drive Eraser** → *your friend* presents. (Secure Data Wiping, NIST SP 800‑88)

> **One‑line story (say it in the intro):**
> **"Deleting a file doesn't destroy it — we prove that by recovering it. And when data *must* be destroyed for safe disposal, we destroy it provably — and issue a certificate that can't be forged. Two sides of the digital‑evidence lifecycle, in one platform."**

---

## What's in this folder

| File | Use it for |
|---|---|
| `00_START_HERE.md` | This master guide + setup + checklist |
| `01_RETRIEVAL_DEMO.md` | Part A — your step‑by‑step manual demo + narration |
| `02_DELETION_DEMO.md` | Part B — your friend's step‑by‑step manual demo + narration |
| `03_JUDGE_QA.md` | Likely judge questions + confident answers (**read twice**) |
| `04_PITCH_AND_UNIQUENESS.md` | The pitch, why it's unique, PS alignment |
| `05_TECH_DEEP_DIVE.md` | Deeper technical answers |
| `assets/demo_evidence.raw` | A ready‑made evidence image (optional — you can use your own, see 01) |

---

## The app you'll run (open it yourself — no script)

Open this file in File Explorer and double‑click it:
```
apps\desktop\out\SIH Recovery Platform-win32-x64\recovery-platform.exe
```
- For the **retrieval** demo: just double‑click it (normal).
- For a **live device wipe** (deletion): **right‑click → Run as administrator** (a wipe needs admin; the dry‑run does not).

The app is self‑contained — the recovery engine is bundled inside. Nothing else to install.

> Tip: right‑click `recovery-platform.exe` → **Send to → Desktop (create shortcut)** so it's one click on stage. Rename the shortcut "SHUNYA".

---

## ✅ Pre‑demo checklist (rehearse the morning of)

- [ ] Laptop charged; projector/mirroring tested; display scaling increased so judges can read.
- [ ] Open the app once and do a **full retrieval run** (see `01`). Confirm it recovers files and flags **1 threat**.
- [ ] Generate a **certificate** once and click **Verify** → it says *Authentic*. (This is your standout moment.)
- [ ] Decide the retrieval evidence: the included `assets\demo_evidence.raw`, **or** your own `.raw` image (01 explains how).
- [ ] Pendrive plugged in with a couple of throwaway files; **backup done**; decide live‑wipe vs. dry‑run (see `02`).
- [ ] Both of you have read `03_JUDGE_QA.md`.
- [ ] Close notifications; full‑screen the app.

---

## The flow on stage (~5 min)

1. **Intro** — the one‑line story + the problem (30s).
2. **Part A – Retrieval (you)** — recover "deleted" files; hashes; **YARA‑X flags a malicious file**; verified export + report; **signed recovery certificate** (~2.5 min).
3. **Part B – Deletion (friend)** — securely wipe the pendrive (NIST 800‑88 Clear); **tamper‑proof sanitization certificate** (~2.5 min).
4. **Close** — "Recovery for investigation, sanitization for safe disposal — standards‑aligned, offline, honest, and provable." + Q&A.

You've got a real, working, standards‑literate tool. Own it. 🚀
