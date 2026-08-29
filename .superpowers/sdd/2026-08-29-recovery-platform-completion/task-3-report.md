# Task 3 report: external-tool discovery and release capability manifests

## Status

Implemented and verified. The production lock remains empty, so the daemon continues to report Sleuth Kit, PhotoRec, YARA-X, and Volatility as unavailable. No third-party binary was downloaded, staged, or committed.

## Delivered behavior

- Native discovery accepts only explicit paths beneath a supplied tool root; it never searches `PATH`.
- Candidates are checked for non-empty identity/version/license/origin, lowercase SHA-256, platform match, safe relative path, regular non-symlink file, network-disabled declaration, and reviewed redistribution approval.
- The file is SHA-256 verified before its version probe. Version capture uses direct process spawning without a shell, an empty environment, closed stdin, a timeout, kill-on-drop, and 64 KiB bounds for each output stream.
- Discovery emits typed statuses including `available`, `missing`, `platform_mismatch`, `hash_mismatch`, `version_mismatch`, `network_forbidden`, `redistribution_forbidden`, `invalid_metadata`, `unsafe_path`, `symlink_forbidden`, and `probe_failed`.
- Only `available` candidates enter the generated version-1 lock. The capability report retains unavailable candidates and observed hash/version fields. The generator writes both files and exits 2 when any candidate is unavailable.
- Runtime registry loading independently refuses network-enabled or redistribution-unapproved lock entries and re-hashes an executable immediately before `ToolRunner` directly spawns it.
- Packaging validates every lock entry, including entries for other platforms, before selecting current-platform payloads.
- The example catalog covers TestDisk, PhotoRec, Sleuth Kit (`mmls`, `fls`, `icat`), libewf (`ewfinfo`, `ewfverify`, `ewfexport`, `ewfacquire`), YARA-X, and Volatility 3. Redistribution defaults to false and hash/version/platform values are deliberate placeholders.

## TDD evidence

Observed RED:

1. `cargo test -p tool-runner --test discovery` failed to compile because `DiscoveryStatus`, `NativeToolCandidate`, `ToolDiscoveryRequest`, `ToolDiscoveryReport`, and `discover_tools` did not exist.
2. `cargo test -p tool-runner --test manifest_generator` failed because `CARGO_BIN_EXE_tool-manifest-generator` did not exist.
3. The focused missing-license test failed with `left: Available`, `right: InvalidMetadata` before the license validation was added.

Observed GREEN:

- Discovery tests cover verified version/hash/license/origin/platform capture, missing files, platform mismatch, hash mismatch without probing, version mismatch, forbidden network declarations before file access, unapproved redistribution, and missing license metadata.
- Generator tests cover successful lock/report output, typed missing output with exit 2, and a real end-to-end native fixture path from catalog generation through registry reload, pre-execution re-hash, and direct execution.
- Registry regressions cover tamper rejection, network-enabled lock rejection, and redistribution-unapproved lock rejection. Existing no-shell, cancellation, and fault-containment tests remain green.

## Verification

- `cargo test -p tool-runner` — pass.
- `cargo test -p fault-injection-tests --test tool_crash` — pass.
- `cargo clippy -p tool-runner --all-targets -- -D warnings` — pass.
- `cargo test --workspace --no-run` — all workspace test targets compile.
- `corepack pnpm --filter @recovery/desktop typecheck` — pass.
- Platform package test selection (`package-integrity`, `packaging-config`, `release-assembly`) — 5 pass, 0 fail.
- `cargo fmt --all -- --check` and `git diff --check` — pass in final verification.

## Primary sources checked 2026-08-29

- The Sleuth Kit repository, license notes, and releases: https://github.com/sleuthkit/sleuthkit and https://github.com/sleuthkit/sleuthkit/releases
- TestDisk/PhotoRec official download and TestDisk license page: https://www.cgsecurity.org/wiki/TestDisk_Download and https://www.cgsecurity.org/wiki/TestDisk
- libewf repository and package specification: https://github.com/libyal/libewf and https://github.com/libyal/libewf/blob/main/libewf.spec.in
- YARA-X repository and releases: https://github.com/VirusTotal/yara-x and https://github.com/VirusTotal/yara-x/releases
- Volatility 3 repository, releases, and custom license: https://github.com/volatilityfoundation/volatility3 , https://github.com/volatilityfoundation/volatility3/releases , and https://www.volatilityfoundation.org/license/vsl-v1.0

## Files changed

- `crates/tool-runner/src/discovery.rs`
- `crates/tool-runner/src/bin/tool_manifest_generator.rs`
- `crates/tool-runner/src/bin/tool_runner_fixture.rs`
- `crates/tool-runner/src/manifest.rs`
- `crates/tool-runner/src/lib.rs`
- `crates/tool-runner/Cargo.toml`
- `crates/tool-runner/tests/discovery.rs`
- `crates/tool-runner/tests/manifest_generator.rs`
- `crates/tool-runner/tests/hash_verification.rs`
- `crates/tool-runner/tests/support/mod.rs`
- `tests/fault-injection/tool_crash.rs`
- `tools/manifests/tools.schema.json`
- `tools/manifests/tool-candidates.example.json`
- `packaging/scripts/stage-tools.ts`
- `docs/operations/tool-manifest-generation.md`
- `docs/operations/manual-release.md`
- `docs/operations/release-checklist.md`
- `THIRD_PARTY_NOTICES.md`

## Self-review and concerns

- Sleuth Kit uses component-specific mixed licensing, so the example intentionally requires per-file license review instead of asserting one blanket SPDX identifier.
- Volatility 3 uses the custom Volatility Software License. Its example remains redistribution-unapproved until legal review covers the exact artifact and dependencies.
- libewf's tool package declares LGPL-3.0-or-later, while the repository contains components under other terms; copied runtime libraries still require individual review.
- The generator verifies local artifact identity and recorded provenance but cannot prove the legal review occurred; `redistributionAllowed` is an explicit human approval gate, and packaging fails closed when it is absent or false.
- The daemon does not consume the generated capability report in this change and no real forensic tool execution is claimed. Its unavailable limitations remain accurate. Generated locks are compatible with the existing verified `ToolRegistry`/`ToolRunner` execution boundary, proven only with the end-to-end fixture.
- OS-level network sandboxing remains an external worker/platform responsibility. This change rejects every entry that declares network access and does not weaken the existing air-gapped execution policy.

## Review fix round 1

Commit follow-up addresses every review finding with observed RED/GREEN evidence:

- **Inherited-pipe timeout:** RED showed a version-probe descendant holding stdout/stderr open beyond the 700 ms test guard (the test process lasted about five seconds). The probe now applies one deadline to child wait and both bounded drains, aborts drain tasks, requests child termination, bounds cleanup wait, and awaits task cancellation. The real descendant-inherited-pipe regression completes within the guard and returns `probe_failed`.
- **Ancestor symlink containment:** RED resolved an executable through an ancestor symlink outside the tool root and reported `available`. Discovery now canonicalizes the root and candidate before reading or probing, requires containment, and returns `symlink_forbidden` without observed hash/version fields for an escape.
- **Exact version match:** RED accepted expected `1.2.3` from output `fixture-tool 11.2.30`. Version matching now compares normalized complete version tokens (including an optional `v` prefix), and the near collision returns `version_mismatch`.
- **Duplicate candidate IDs:** RED exited 2 after writing a duplicate lock/report, and a direct discovery regression showed duplicate candidates entering their probes. Catalog uniqueness is now validated before discovery or writes; duplicates exit 1 and leave both outputs absent. Direct `discover_tools` calls also mark every duplicated ID invalid before any probe. The generator additionally loads the generated manifest through `ToolRegistry` before writing it.
- **Package stageability/off-platform validation:** RED could not import a staging boundary because staging existed only inside the packaging main program. `stageExternalTools` now behaviorally stages a non-empty verified lock, canonicalizes current-platform sources, and validates metadata, digest syntax, approval flags, duplicate IDs, and safe paths for every platform before selection. Tests prove both non-empty staging and off-platform malformed path/hash refusal. Only current-platform payload bytes can be re-hashed because other platform files are not expected on a native build host.

Round verification commands and results are recorded in the final task handoff. No third-party binary was added, and the daemon capability behavior remains unchanged and truthful.

## Review fix round 2

The scoped runtime-validation re-review was handled with another RED/GREEN cycle:

- **Parsed lock entry types:** RED showed omitted `networkAllowed` on both current- and off-platform entries falling through to an unrelated missing-directory error; blank/non-string fields were likewise accepted until filesystem access. `stageExternalTools` now parses `JSON.parse` output as `unknown` and validates every entry as an object with only the schema fields, nonblank string identity/version/license/origin/path, the allowed platform enum, a 64-character lowercase hexadecimal SHA-256, `networkAllowed === false`, and `redistributionAllowed === true`. Duplicate identity is scoped to `(id, platform)`, so one tool can have native entries for multiple platforms.
- **Portable paths and pre-filtering:** path safety now recognizes both Windows and POSIX absolute/traversal forms regardless of the build host. Every entry is parsed and path-normalized before platform selection; payload existence, canonical containment, and content hashing remain current-platform checks because other native payloads are not present on a single-platform build host.
- **Rust off-platform invariants:** RED showed invalid SHA, unsafe path, unsupported platform, and duplicate `(id, platform)` entries all being silently skipped when they targeted another host. `ToolRegistry::from_manifest` now validates required fields, approval flags, platform, SHA, non-empty safe path, and `(id, platform)` uniqueness for the entire manifest before filtering. A regression confirms the same ID remains valid across different platforms.

Focused GREEN evidence: six package-staging tests and eight registry hash/manifest tests pass. Final package, Rust, typecheck, clippy, formatting, and diff results are reported in the task handoff.

## Review fix round 3

Portable path safety is now independent of the build host:

- RED showed no shared Rust predicate, discovery resolving `fixture/./tool-runner-fixture` as available, the registry accepting that form on an off-platform entry, and staging normalizing it instead of rejecting it.
- `is_portable_tool_relative_path` is the single Rust predicate used by both discovery and `ToolRegistry`. It accepts UTF-8 forward-slash relative components and rejects empty paths/components, `.`/`..`, POSIX roots, every backslash form (therefore Windows drive, UNC, and device paths), Windows drive/ADS colons, control or Windows-forbidden characters, trailing dot/space components, and Windows reserved device names.
- TypeScript staging mirrors the same portable grammar before host-native normalization. This makes the checked-in manifest representation stage-compatible on Windows and POSIX while retaining canonical-root containment for current-platform payload access.
- Cross-platform raw-string regressions cover Unix-host exposure to Windows drive/UNC/device/traversal forms and Windows-host exposure to POSIX roots/traversal, plus ambiguous dot, repeated/trailing separator, ADS, and reserved-name forms. Existing generator-to-registry execution and non-empty package staging tests prove safe generated paths remain loadable and stageable.

Focused GREEN evidence: two portable-predicate tests, the discovery dot-component regression, the off-platform registry path table, and seven staging tests pass. Final regression totals are recorded in the task handoff.
