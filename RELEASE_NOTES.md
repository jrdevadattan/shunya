# SHUNYA Recovery 0.3.0

Windows x64 recovery + secure‑erase workstation. This release makes threat
scanning genuinely real, adds a flash secure‑erase module with a tamper‑evident
certificate, and refreshes the interface.

## Highlights

- **Real YARA‑X threat scanning.** Recovered files are scanned by the real,
  pure‑Rust YARA‑X engine (built‑in SIH + EICAR demonstration rules); matches are
  flagged as *Potentially unsafe*, quarantined, and preview‑blocked. Replaces the
  previous placeholder. The Results screen summarises how many files were flagged.
- **Secure Drive Eraser (flash / removable media).** An "Erase a device" workflow
  performs a full‑device **CSPRNG overwrite** (single AES‑256‑CTR keystream pass) —
  an overwrite‑based **NIST SP 800‑88 Rev. 2 Clear** method (correctly *not* called
  "cryptographic erase"). The system disk is protected and never selectable; a live
  wipe requires administrator rights and an exact‑device‑path confirmation; a safe
  **dry‑run** exercises the pipeline without touching the device.
- **Tamper‑evident certificate.** Both the erase utility and the recovery report can
  issue an **Ed25519‑signed certificate** that verifies in‑app as *Authentic* and
  detects any modification. Certificates can be saved as a self‑contained HTML
  document and printed to PDF.
- **Read‑only recovery with chain of custody.** RAW/dd images, GPT/MBR discovery,
  bounded JPEG signature carving, deterministic validation, SHA‑256 of the source
  before/after, verified export (refuses a same‑device destination), and JSON/Markdown
  reporting — all offline.
- **Refreshed UI.** A premium visual foundation (depth, gradients, motion), an
  animated live‑recovery view, and honest "unavailable" states for capabilities not
  in this build.

## Windows assets

- `SIH-Recovery-Platform-Setup.exe` — Windows x64 installer.
- `sih_recovery_platform-0.3.0-full.nupkg` — Windows x64 Squirrel update package.
- `SHA256SUMS` — cryptographic checksums for the published assets.

The Windows artifacts are unsigned (no Authenticode certificate supplied); Windows may
show a SmartScreen warning.

## Honest capability limits

The packaged slice recovers content by **JPEG signature carving** from RAW images; it
does not restore original filenames/folders and reports The Sleuth Kit, PhotoRec, and
broader tooling as **unavailable** (shown honestly in the UI, never faked). Volatility
memory analysis and physical‑device acquisition are not in this build. The CSPRNG
overwrite is a **Clear**; firmware **Sanitize** (ATA Secure Erase / NVMe Sanitize) for
**Purge**‑level assurance is roadmap. SSD TRIM, overwriting, and physical damage can make
recovery impossible. Linux, macOS, and Rescue ISO artifacts are not part of this Windows
release (the Rescue ISO must be built on Linux with `live-build`).
