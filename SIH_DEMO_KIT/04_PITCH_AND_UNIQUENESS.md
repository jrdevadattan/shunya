# Pitch, Uniqueness & Problem‑Statement Alignment

## The 45‑second opening pitch (memorise this)

> "Every deleted file leaves a ghost. For an investigator, that ghost is evidence. For anyone throwing away an old laptop or phone, it's a data leak waiting to happen.
>
> **SHUNYA** is one offline platform for the whole data lifecycle: it **recovers** deleted data with a full chain of custody — even flagging malware hidden in what it recovers — and it **securely destroys** data to international standards so a device can be safely reused or recycled.
>
> We built it **trust‑first**: it never writes to evidence, it fingerprints everything with SHA‑256, it quarantines anything dangerous, and — unlike most tools — **it's honest about exactly what it can and cannot do.** That's what makes results defensible."

---

## The problem (both sides)

1. **Recovery (SIH PS 26149):** investigators and citizens lose data to accidental deletion, formatting, and failing media. They need recovery that's **trustworthy and court‑defensible**, not a black box.
2. **Secure disposal (Secure Data Wiping):** India generates huge e‑waste, but organisations and people **hoard** old devices because they fear data leaks. Safe reuse/recycling needs **provable, standards‑aligned destruction**.

**Insight that connects them:** you cannot claim data is *securely destroyed* unless you understand how easily it is *recovered*. We do both — so our destruction claims are credible.

---

## Why SHUNYA is unique (the 4 pillars)

1. **Two problem statements, one honest platform.** Recovery *and* sanitization, sharing a trustworthy core but architecturally separate (read‑only vs. write‑destructive).
2. **Standards‑literate, not buzzword‑literate.** We implement and *correctly name* NIST SP 800‑88 Rev. 2 methods (Clear vs. Purge vs. Cryptographic Erase) and cite IEEE 2883‑2022. A judge can verify our terminology — and it holds up.
3. **Trust‑first engineering.** Read‑only evidence; SHA‑256 chain of custody; malware **quarantine** of recovered content; verified exports; and a report that **states its own limits**. Honesty is a feature.
4. **Fully offline & memory‑safe.** No telemetry, no cloud, no auto‑update; a Rust core behind a sandboxed, hash‑verified boundary. Built for seized and sensitive devices.

> **The one‑liner:** *"Most tools do one half of the data lifecycle and overclaim. We do both halves and under‑claim — which is exactly why you can trust the result."*

---

## Standards & references to name‑drop (correctly)

- **NIST SP 800‑88 Rev. 2** — *Guidelines for Media Sanitization* (Clear / Purge / Destroy; Cryptographic Erase definition).
- **IEEE 2883‑2022** — *Standard for Sanitizing Storage*.
- **SHA‑256** — integrity / chain of custody.
- **YARA‑X** — modern, pure‑Rust rule engine for threat classification.
- **AES‑256‑CTR** — the CSPRNG keystream for the overwrite (CTR, deliberately not GCM).
- **EICAR** — the industry‑standard *harmless* antivirus test file used in the demo.

---

## What to show vs. what to claim

| Show live (works today) | Say is roadmap (don't fake) |
|---|---|
| Read‑only image recovery + JPEG carving | Multi‑format carving (PhotoRec) |
| SHA‑256 hashing + verified export + report | Metadata recovery / original filenames (Sleuth Kit) |
| **Real YARA‑X** malware flag on recovered file | Memory analysis (Volatility) |
| CSPRNG flash wipe (NIST Clear) + audit log | Firmware Sanitize (Purge) & signed certificate |
| System‑disk protection, honest limitations | Linux/macOS/Rescue‑ISO builds |

Lead with the working slice, be proud of the honesty, and route "can it do X?" to the roadmap + the report's limitations. That posture wins.
