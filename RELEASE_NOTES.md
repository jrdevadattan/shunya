# SIH Recovery Platform 0.1.0

First release-candidate implementation of the SIH 26149 offline recovery workstation.

Highlights include read-only RAW/split/E01 evidence access, MBR/GPT discovery, metadata recovery and carving, safe validation/quarantine/previews, million-row indexed review, verified exports/reports, resumable acquisition and jobs, damaged-media ddrescue workflow, typed Volatility memory analysis, and Debian-based Rescue Mode.

Artifacts are built manually on native Windows, Linux, and macOS hosts. `SHA256SUMS` and `release-manifest.json` cover every published file. Code signing is applied only when the release operator securely supplies the required identity on that host; checksum verification remains mandatory. A draft must not be published until Windows x64, Debian x64, macOS x64/arm64, and Rescue x64 assets all pass the release-set check.

Important: SSD TRIM, overwriting, encryption without authorized keys, and physical damage can make recovery impossible. Carved files normally lack original names/folders. Installed Mode is not equivalent to a trusted Rescue environment. Review `docs/operations/recovery-limitations.md` before use.
