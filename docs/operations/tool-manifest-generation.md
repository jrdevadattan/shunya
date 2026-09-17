# Verified external-tool manifest workflow

The repository intentionally ships an empty `tools/manifests/tools.lock.json`. This workflow never downloads a tool and never treats a command found on `PATH` as trusted. A release engineer must obtain an exact upstream artifact, verify its provenance and redistribution terms, and place only the reviewed executable and required redistributable runtime files beneath `tools/vendor/<platform>/`.

## Generate a candidate lock

1. Copy `tools/manifests/tool-candidates.example.json` to a platform-specific working file outside the commit, then remove tools that are not being reviewed in this release.
2. Replace every placeholder with the exact release version, supported platform ID, relative executable path, and a SHA-256 obtained from an authenticated upstream checksum or independently verified release artifact.
3. Review the exact executable/component license and required notices or source-offer obligations. Set `redistributionAllowed` to `true` only after that review. Keep `networkAllowed` false.
4. Place the reviewed executable at `tools/<relativePath>`. Do not use a symlink.
5. Build and run the native generator from the repository root:

   ```powershell
   cargo run -p tool-runner --bin tool-manifest-generator -- --tools-root tools --candidates C:\review\tool-candidates.windows-x64.json --manifest tools\manifests\tools.lock.json --report C:\review\tool-capabilities.windows-x64.json
   ```

The generator hashes the file before executing its version probe. The probe is a direct process spawn with no shell, an empty environment, closed stdin, a five-second timeout, and bounded output. It writes both outputs even when a candidate is unavailable, then exits with code 2 if any candidate failed validation. Only `available` candidates enter the lock; missing, wrong-platform, hash-mismatched, version-mismatched, network-enabled, symlinked, or redistribution-unapproved candidates remain typed unavailable in the capability report.

After generation, run `cargo test -p tool-runner` and the package tests. Packaging re-hashes each selected file and refuses network-enabled or redistribution-unapproved entries. Runtime execution independently re-hashes the selected executable immediately before direct spawning through `ToolRunner`.

## Enabling PhotoRec for content-signature carving

The daemon carves with its built-in multi-format engine by default and records the
limitation `PHOTOREC_UNAVAILABLE` on every job. To have it run PhotoRec instead:

1. Obtain the exact upstream TestDisk/PhotoRec release archive from
   https://www.cgsecurity.org/wiki/TestDisk_Download and verify its checksum against
   the published value.
2. Copy only the PhotoRec executable (and, on Windows, any redistributable DLLs it
   ships beside it) to `tools/vendor/<platform>/`, for example
   `tools/vendor/windows-x64/photorec_win.exe`.
3. In your candidate file keep the `photorec` entry, set `relativePath` to that
   file, set the exact `version` (the string printed by `photorec_win.exe /version`,
   e.g. `7.2`), set `expectedSha256`, and set `redistributionAllowed` to `true` only
   after the GPL-2.0-or-later obligations (source offer, notice in
   `THIRD_PARTY_NOTICES.md`) have been reviewed.
4. Run the manifest generator as described above so `tools/manifests/tools.lock.json`
   gains the verified entry, then rebuild and package.

At runtime the daemon locates the catalog either from `RECOVERY_TOOLS_ROOT` /
`RECOVERY_TOOLS_MANIFEST` (set automatically by the desktop app in development) or,
when packaged, from `tools.lock.json` and `tools/` beside `recoveryd`. Before every
run it re-hashes the executable, spawns it directly with no shell and an empty
environment, writes the transcript to `work/<job>/photorec-run/`, and parses the
DFXML `report.xml` for source byte runs. If PhotoRec exits non-zero or times out, the
job records `PHOTOREC_FAILED` and falls back to the built-in engine, so a broken
vendoring never produces an empty result set silently.

## Upstream provenance and licensing references

Checked 2026-08-29 against primary project sources:

- The Sleuth Kit repository and release page: https://github.com/sleuthkit/sleuthkit and https://github.com/sleuthkit/sleuthkit/releases. Its own license section describes component-specific licensing, including IBM/CPL for filesystem tools and GPL for some utilities; review each packaged file rather than assigning one blanket license.
- TestDisk and PhotoRec official download and project pages: https://www.cgsecurity.org/wiki/TestDisk_Download and https://www.cgsecurity.org/wiki/TestDisk . CGSecurity describes the portable archives and identifies TestDisk as GPL v2 or later; PhotoRec is delivered from the same official project release.
- libewf official repository and package specification: https://github.com/libyal/libewf and https://github.com/libyal/libewf/blob/main/libewf.spec.in . The tool package specification declares LGPL-3.0-or-later and includes the license files; review all accompanying libraries copied with a tool.
- YARA-X official repository and releases: https://github.com/VirusTotal/yara-x and https://github.com/VirusTotal/yara-x/releases . The project declares BSD-3-Clause.
- Volatility 3 official repository, releases, and license: https://github.com/volatilityfoundation/volatility3 , https://github.com/volatilityfoundation/volatility3/releases , and https://www.volatilityfoundation.org/license/vsl-v1.0 . Volatility 3 uses the custom Volatility Software License; keep redistribution disabled until legal review approves the exact distribution.

These references establish project provenance and declared licensing, not permission for this product to redistribute every upstream archive or dependency. The reviewed release record and third-party notices remain mandatory.
