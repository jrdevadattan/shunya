# Manual native release guide

SIH Recovery Platform releases do not use CI/CD. Every artifact must be built from the same reviewed commit on the operating system it targets. Keep the GitHub release as a draft until the release-set check for the explicitly approved scope succeeds.

## Common preparation

Install Node.js 24, Corepack/pnpm 10.15, Rust 1.98, Git, GitHub CLI, and the native compiler toolchain. On every build host, check out the exact release commit and run:

If the release includes external forensic tools, complete `docs/operations/tool-manifest-generation.md` on each native build host first. An empty lock is valid and means those capabilities remain unavailable; never substitute tools found on `PATH`.

```sh
corepack enable
corepack pnpm install --frozen-lockfile
cargo build --workspace --release --locked
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
cargo fmt --all -- --check
```

Set `RECOVERY_RELEASE_BUILD=1` while packaging. Copy finished artifacts into one release directory, such as `dist/release/v0.1.0`. Do not copy an unpacked application directory as a release asset.

## Windows x64

Use a native Windows x64 host and PowerShell:

```powershell
$env:RECOVERY_RELEASE_BUILD = '1'
corepack pnpm --filter @recovery/desktop make
Push-Location apps/desktop
corepack pnpm exec tsx ../../packaging/scripts/verify-package.ts 'out/SIH Recovery Platform-win32-x64'
Pop-Location
```

Collect the Setup `.exe` and full `.nupkg` from `apps/desktop/out/make/squirrel.windows/x64`. Optional Authenticode signing uses `WINDOWS_CERTIFICATE_FILE` and `WINDOWS_CERTIFICATE_PASSWORD`; keep both outside the repository and clear them after use.

## Debian Linux x64

Use native Debian x64 with `fakeroot`, `dpkg`, and RPM tooling installed:

```sh
export RECOVERY_RELEASE_BUILD=1
corepack pnpm --filter @recovery/desktop make
cd apps/desktop
corepack pnpm exec tsx ../../packaging/scripts/verify-package.ts 'out/SIH Recovery Platform-linux-x64'
```

Collect the `.deb` from `apps/desktop/out/make/deb/x64`.

## macOS x64 and arm64

macOS packages cannot be truthfully produced or validated on Windows or Linux. Run the common preparation and these commands once on an Intel Mac and once on an Apple Silicon Mac, using the same commit:

```sh
export RECOVERY_RELEASE_BUILD=1
corepack pnpm --filter @recovery/desktop make
cd apps/desktop
corepack pnpm exec tsx ../../packaging/scripts/verify-package.ts "out/SIH Recovery Platform-darwin-$(node -p 'process.arch')"
```

Collect both the DMG and ZIP from `apps/desktop/out/make`. For signing, set `MAC_CODESIGN_IDENTITY` to a certificate already installed in the protected login keychain. Notarization is a separate operator step; state explicitly in the release notes whether each package is signed and notarized. Never label an ad-hoc or unsigned package as notarized.

## Rescue ISO

Use native Debian Bookworm x64 with `live-build`, `fakeroot`, `dpkg`, and RPM tooling. Build the Linux desktop package first, stage its `.deb` and the release privileged helper in `live/config/includes.chroot/opt/recovery/staging`, then run:

```sh
sh live/scripts/verify-live.sh
RECOVERY_VERSION=v0.1.0 sh live/scripts/build-live.sh
```

Collect the ISO, its `.sha256`, and its `.manifest.json` from `dist/rescue`. Boot-test both BIOS and UEFI paths before publication.

## Assemble and publish

After collecting all native artifacts in the release directory:

```sh
node packaging/scripts/assemble-release.mjs dist/release/v0.1.0 v0.1.0
node packaging/scripts/verify-release-set.mjs dist/release/v0.1.0
```

The default verifier remains the complete multi-platform publication gate. For the explicitly approved Windows-x64-only `v0.2.0` release, use the narrower profile; it still requires the Setup EXE, full NUPKG, `SHA256SUMS`, and `release-manifest.json`, and rejects files not covered by the manifest:

```powershell
node packaging/scripts/verify-release-set.mjs --profile windows-x64 dist/release/v0.2.0
```

Do not use the Windows profile for a release that claims Linux, macOS, or Rescue assets.

Review `SHA256SUMS`, `release-manifest.json`, filenames, signing/notarization status, and the release checklist. Upload to a draft GitHub release with `gh release upload`. Publish only when the verifier succeeds and the draft targets the exact reviewed commit. Download every published asset once and re-check it against `SHA256SUMS`.
