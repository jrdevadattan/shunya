# Judge Q&A — answer with confidence, never bluff

**Golden rule:** judges reward **honesty + standards literacy** over big claims. When something isn't in this build, say "that's our roadmap; today we ship the honest, working slice" and point to the report's limitations section. Never invent a feature live.

---

## The question they *will* ask

**Q. "You use a tool for deletion — can the same tool also do the recovery? Aren't they the same thing?"**
> One **platform**, two **deliberately separate modules** with *opposite* safety postures:
> - **Recovery** is strictly **read‑only** — it never writes a single byte to the evidence.
> - **Deletion** is **write‑destructive** — with hard guards: the system disk is un‑selectable, only removable media is eligible, and you must type the exact device path to confirm.
>
> They share the trustworthy foundation — SHA‑256 hashing, per‑case audit logging, honest capability reporting — but the two code paths can never be confused. That's *why* it's one platform: recovery for investigation, sanitization for disposal, covering **two SIH problem statements** with one auditable pipeline.

---

## Recovery questions

**Q. Isn't this just PhotoRec / Recuva?**
> The algorithm (signature carving) is well known — our value is the **trustworthy workflow around it**: read‑only evidence handling, a chain of custody (case + operator + SHA‑256 before/after), **threat scanning of recovered content**, verified exports, an honest report, and a single offline pipeline. We integrate mature engines (e.g., **YARA‑X**) behind typed, sandboxed adapters rather than reinventing them. Consumer tools recover files; we produce **court‑defensible evidence**.

**Q. What about SSDs / TRIM?**
> We're honest: after **TRIM + garbage collection**, data can be permanently gone, and we report that as an **explicit limitation**, not a software defect. Magnetic media and pre‑TRIM SSDs recover well. Overclaiming "we recover everything" is exactly what a knowledgeable judge would catch — we don't.

**Q. Why can't you recover the original file names?**
> This build uses **signature carving**, which recovers *content* from unallocated space but generally can't prove the original name or folder — a documented limit. Name/timestamp recovery needs a **metadata engine** (e.g., The Sleuth Kit), which is on our roadmap and shown in the UI as "not in this build." We never fake a filename.

**Q. Why scan recovered files for malware?**
> Recovered content is **untrusted** — it can carry malware. Our **YARA‑X** engine scans it and **quarantines** it; recovered files are *never* auto‑opened, previews of unsafe content are blocked. Recovering evidence should not infect the investigator's machine. You saw it flag a real (harmless EICAR) signature live.

---

## Deletion questions

**Q. Is the data *truly* unrecoverable after your wipe?**
> Across the entire **logical address space**, yes — every sector is overwritten with a CSPRNG (AES‑256‑CTR) keystream. We're honest that on flash, **wear‑leveling / over‑provisioning** means a few *physical* NAND cells may not be addressable, so we correctly label this a NIST **Clear**, and we offer firmware **Sanitize** (ATA Secure Erase / NVMe Sanitize) as the **Purge**‑level path. That honesty is precisely what a compliance auditor needs.

**Q. Why do you call it "CSPRNG overwrite" and not "cryptographic erase"?**
> **NIST SP 800‑88** reserves *Cryptographic Erase* for a specific method — data is encrypted at write time and sanitized by **destroying the key**, with no rewrite. We do the opposite: we **rewrite** the data with random bytes and keep **no key**. Both reach a similar end state on flash, but they're different categories, and conflating them is a compliance‑accuracy error. Getting the terminology right shows we actually understand the standard.

**Q. Why AES‑256‑CTR and not GCM?**
> CTR gives a fast, high‑quality keystream. **GCM** adds an authentication tag to *detect tampering* — which is pointless when the whole goal is to **destroy** data. CTR is the correct, leaner choice here.

**Q. Why not multi‑pass (DoD 5220.22‑M / Gutmann)?**
> Those were designed for old magnetic media. For modern flash, **NIST 800‑88 and IEEE 2883** say a single pass is sufficient and multi‑pass is obsolete (and just wears the flash). One CSPRNG pass is the current best practice.

**Q. Tell us about your certificate — can it be forged or tampered with?**
> No. Every certificate is signed with an **Ed25519** key over a canonical record of the operation (device, method, standard, timestamp, operator). The app **verifies** it in one click — it says *Authentic* only if the signature, the public‑key fingerprint, **and** the payload hash all match. Change a single character of any field and verification fails. The public‑key **fingerprint is the trust anchor**, so a third party can verify the certificate **offline** with any standard Ed25519 tool — no server needed. We also keep an NDJSON audit log of every step. *(Production hardening: the signing key would live in an HSM / secure key store rather than on the workstation — the mechanism is identical.)*

**Q. Is that a real cryptographic signature or just a hash?**
> A real **digital signature** (Ed25519, via the platform crypto). A hash alone proves integrity but not origin; a signature proves **both** — that *this* key issued it and nothing changed since. That's why the certificate is defensible as a disposal/compliance record.

---

## Strategy / "why you" questions

**Q. What makes this unique — why is *this* the tool?**
> Four things: **(1)** it covers **both** SIH problem statements — recovery *and* secure sanitization — as one honest platform; **(2)** it's **standards‑literate** (NIST 800‑88, IEEE 2883) with terminology a judge can verify; **(3)** it's **trust‑first** — read‑only evidence, chain of custody, malware quarantine, and it *tells you what it can't do*; **(4)** it's **fully offline** — no telemetry, no cloud, suitable for seized or sensitive devices. Most tools do one half and overclaim. We do both and under‑claim.

**Q. Why offline / air‑gapped?**
> Digital evidence and device disposal involve sensitive data. Nothing leaves the machine — no network calls, no telemetry, no auto‑update. That's a hard requirement for government and forensic use.

**Q. Who is this for?**
> Law enforcement / forensic examiners (recovery), and IT‑asset‑disposal / recycling and government departments (secure wiping for safe reuse — the e‑waste data‑leak problem). Both need something **defensible**, not just functional.

**Q. Can we trust the results in court?**
> Yes — read‑only sources, SHA‑256 of the source **before and after** (proving we didn't alter it), per‑file hashes, every action logged against a case and operator, exports re‑verified byte‑for‑byte, and a report that documents method **and** limitations. It's designed to survive cross‑examination.

**Q. What can it *not* do (and how do you handle that)?**
> It **fails safe**: unsupported filesystems, damaged media, or missing metadata produce an explicit *limited/unsupported* outcome that preserves evidence and suggests a next step — never a silent guess. Not in this build (and shown honestly as unavailable): metadata recovery (Sleuth Kit) and memory analysis (Volatility). Both are on the roadmap behind the same sandboxed adapter design that already runs YARA‑X and PhotoRec.

**Q. Which file types can you carve?**
> Twenty‑one format groups across six families the operator can switch on or off: images (JPEG, PNG, GIF, BMP, WebP), documents (PDF, DOCX/XLSX/PPTX, DOC/XLS/PPT, ODT), archives (ZIP, 7z, RAR, GZIP), audio/video (MP4/MOV/M4A/3GP, MP3, WAV, AVI), databases (SQLite) and executables (EXE/DLL, ELF, JAR, APK). Every hit is bounded by the format's own structure — a JPEG ends at its real EOI even when an EXIF thumbnail sits inside it, a ZIP ends at the central directory that matches its own start, an MP4 at the end of its box table — and then validated. If a verified PhotoRec binary is vendored, it runs sandboxed instead and its byte runs feed the same evidence model.

---

## Technical questions

**Q. Tech stack — why Rust + Electron?**
> **Rust** for a memory‑safe, high‑integrity recovery/erase core — no buffer‑overflow class of bugs while parsing untrusted disk data. **Electron/React** for a cross‑platform, accessible UI. They talk over a **sandboxed, typed IPC** boundary, and the recovery daemon binary is **SHA‑256‑verified** before it's launched.

**Q. How does the threat scan actually work?**
> The real **YARA‑X** engine (pure‑Rust) compiles YARA rules and scans each recovered file; matches set the file's threat status and block its preview. Today it ships a demonstration ruleset (the SIH marker + the industry‑standard EICAR test); a full production ruleset drops in without code changes.

**Q. Does it work on Linux too?**
> The architecture is cross‑platform (the erase path has a Linux implementation too), but **today we're presenting the Windows build** — one target, done well, rather than three, half‑done.
