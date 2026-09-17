# ADR-002: Integrate Mature Forensic Tools Through Versioned Adapters

## Status

Accepted.

## Decision

Use mature forensic tools for their strongest functions and place each behind a typed adapter. The UI, job engine, and case database must never parse ad-hoc console text directly.

Initial adapters:

- The Sleuth Kit for partition/filesystem metadata discovery and metadata-based recovery.
- TestDisk for lost-partition discovery in read-only analysis mode.
- PhotoRec for signature-based carving.
- GNU ddrescue in Rescue Mode for unstable media and resumable acquisition.
- libewf tools for E01/Ex01 reading, verification, and optional acquisition.
- YARA-X for classifying potentially malicious recovered files.
- Volatility 3 for supported memory-image analysis.
- WinPmem on Windows and AVML/LiME on Linux for optional memory acquisition.

## Adapter contract

Every adapter must:

- Declare its exact executable version and SHA-256 checksum.
- Accept structured input from the backend.
- Build an argument array without invoking a shell.
- Run in a per-job working directory.
- Emit normalized JSON events through a parser owned by the adapter.
- Preserve the raw stdout/stderr transcript as evidence.
- Support cancellation and timeouts.
- Return typed outcomes: `SUCCESS`, `PARTIAL`, `UNSUPPORTED`, `CANCELLED`, or `FAILED`.
- Never write to the source.

## Licensing rule

The repository must maintain `THIRD_PARTY_NOTICES.md`, source-offer/build instructions where required, and a manifest for every redistributed binary. PhotoRec/TestDisk are GPL-licensed, libewf is LGPL-licensed, and YARA-X is BSD-licensed. Legal review is required before a closed-source distribution.

## Rejected alternative

Rewriting file carving, filesystem parsing, damaged-media acquisition, and memory analysis from scratch for the SIH prototype is rejected. It would reduce correctness, test coverage, and demonstration quality.

