# SHUNYA Recovery 0.2.0

This release delivers the redesigned Windows x64 recovery workstation and the completed case lifecycle.

## Highlights

- Approved SHUNYA interface across case intake, source assessment, recovery setup, live activity, results, export, reporting, memory analysis, settings, and support.
- Native workspace selection with a bounded folder tree, real storage data, overwrite protection, and immediate duplicate-dialog protection.
- Persistent Recent cases list with validated case reopening and clear guidance before the first recovery job exists.
- Sandboxed Electron renderer with a typed preload boundary and a SHA-256-verified Rust recovery daemon.
- Read-only RAW-image workflow with source revalidation, SHA-256 hashing, GPT/MBR discovery, bounded JPEG signature carving, deterministic validation, indexed review, verified export, and JSON/Markdown reporting.
- Checkpointed recovery jobs with pause, resume, cancellation, event history, and recoverable restart behavior.
- Isolated packaged E2E profiles so temporary test cases cannot enter a shared Electron profile.

## Windows assets

- `SIH-Recovery-Platform-Setup.exe`: Windows x64 installer.
- `sih_recovery_platform-0.2.0-full.nupkg`: Windows x64 Squirrel update package.
- `SHA256SUMS`: cryptographic checksums for the published assets.
- `release-manifest.json`: release metadata and asset hashes.

The Windows artifacts are unsigned because no Authenticode certificate was supplied. Windows may display a SmartScreen warning.

## Capability limits

The packaged vertical slice includes bounded JPEG content-signature recovery. It reports The Sleuth Kit, PhotoRec, and YARA-X as unavailable unless approved, hash-verified binaries are present. It does not claim original names or folders for carved data, and it marks content as not threat-scanned when YARA-X is unavailable.

SSD TRIM, overwriting, missing encryption keys, and physical damage can make recovery impossible. Installed Mode is not equivalent to a clean Rescue Mode environment. Linux, macOS, and Rescue ISO artifacts are not part of this Windows release.
