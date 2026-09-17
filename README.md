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

## NVMe secure erase module

The desktop secure-erase API downloads a release-pinned `nvme-cli` binary to the
application-data cache on first use, verifies its SHA-256 before it is ever run,
and lists only controllers reported by that verified binary. It requires the renderer to repeat the exact selected device path, and
checks that the target is not the operating-system device before dispatching an
elevated command. It attempts NVMe Sanitize Crypto Erase, then Sanitize Block
Erase, and only uses Format NVM user-data erase (`ses=1`) when the caller has
explicitly enabled the lower-assurance fallback. Progress and controller status
are derived from the NVMe Sanitize log; every attempt is appended to an NDJSON
audit log in the application-data directory.

The download URL and platform SHA-256 constants are in
`apps/desktop/src/main/secure-erase/nvmeBinary.ts`; set both to immutable,
controlled GitHub Release assets before shipping. The app invokes `nvme-cli` as
a separate GPL-2.0 subprocess, so its Third-Party Licenses/About view must
credit <https://github.com/linux-nvme/nvme-cli>. Do not add multi-pass overwrite
as an SSD/NVMe sanitization option.
