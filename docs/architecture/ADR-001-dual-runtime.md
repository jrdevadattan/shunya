# ADR-001: One Product, Two Runtime Modes

## Status

Accepted.

## Decision

Build one recovery product with:

1. **Installed Mode** — Electron desktop application for Windows, macOS, Debian-family Linux, and BOSS GNU/Linux.
2. **Rescue Mode** — a bootable, Debian-based x86-64 live ISO/USB that launches the same Electron application and Rust recovery core.

The modes share the same source tree, case format, job engine, tool adapters, UI routes, reporting format, and tests. Runtime capability discovery determines which operations are available.

## Why both are required

Installed Mode is convenient for opening forensic images, recovering from external media, analyzing memory images, and reviewing cases. It is not the safest place to recover deleted data from the currently running system disk because normal operating-system writes may overwrite recoverable blocks. It also cannot assume the installed operating system is trustworthy.

Rescue Mode boots independently, disables automatic mounting, opens sources read-only, and is the preferred route for the system disk, failing devices, raw acquisition, and compromised hosts.

## Rejected alternatives

- **Electron-only installed application:** rejected because it cannot safely cover current-system-disk recovery or compromised-host cases.
- **Live OS only:** rejected because routine use, case review, image analysis, and cross-platform accessibility would be unnecessarily inconvenient.
- **Separate unrelated products:** rejected because duplicated UI, case formats, and recovery behavior would drift.

## Capability behavior

The app displays a persistent runtime badge: `Installed Mode` or `Rescue Mode`. Unsupported operations are not hidden without explanation. They appear disabled with a plain-language reason and a `Use Rescue Mode` action where applicable.

