# SIH Recovery Platform

Cross-platform, offline-first recovery workstation for SIH problem statement 26149. The desktop application uses Electron, React, and a Rust recovery core; the same recovery model is packaged for Windows, Linux, macOS, and an x86-64 Debian-based Rescue ISO.

## Safety model

- Recovery sources are opened read-only. The application never repairs, mounts read-write, undeletes in place, or changes partition tables.
- Exports must target a different physical device and are verified with cryptographic hashes.
- Recovered content is quarantined and treated as untrusted; executable or active content is never auto-opened.
- External forensic tools are invoked without a shell and only after their hashes match the release allowlist.
- Unsupported or incomplete recovery is reported explicitly. See [recovery limitations](docs/operations/recovery-limitations.md).

## Supported workflows

The release includes RAW and split-image access, EWF/E01 adapters, MBR/GPT discovery, filesystem-metadata recovery, controlled signature carving, validation and threat classification, indexed result review, verified export and reporting, physical-source and damaged-media acquisition, memory-image analysis, resumable jobs, and Rescue Mode.

## Development

Requirements: Node.js 24, Corepack/pnpm 10.15, Rust 1.98, and the platform's native compiler toolchain.

```sh
corepack enable
pnpm install --frozen-lockfile
cargo build --workspace --release --locked
pnpm --filter @recovery/desktop start
```

Run the verification suite:

```sh
pnpm lint
pnpm typecheck
pnpm test
cargo fmt --all -- --check
pnpm --filter @recovery/desktop make
pnpm test:e2e
```

## Releases

Releases are built manually on native hosts: Windows for Setup/NuGet, Debian for `.deb` and Rescue ISO, and macOS for Intel and Apple Silicon DMG/ZIP packages. There is no CI/CD release dependency. Follow the [manual release guide](docs/operations/manual-release.md), and do not publish a release until the complete asset check passes.

Verify downloads against `SHA256SUMS` and `release-manifest.json` on the GitHub release page. Code signing is used only when a release operator provides a signing identity securely on the build host; unsigned artifacts remain clearly identified by the operating system.

Start with the [recovery specification](docs/specs/recovery-module.md), [security policy](SECURITY.md), [deployment guide](docs/operations/boss10-deployment.md), [manual release guide](docs/operations/manual-release.md), and [release notes](RELEASE_NOTES.md).
