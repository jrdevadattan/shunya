# Release-candidate checklist

- [ ] Version/tag and release notes match; workspace and lockfiles are clean.
- [ ] `pnpm lint`, `pnpm typecheck`, unit/integration/fault/security/performance tests, full Rust clippy/nextest, and packaged Electron E2E pass.
- [ ] Follow `docs/operations/manual-release.md`; each package is built on its native operating system from the same reviewed commit.
- [ ] Windows Setup, Linux `.deb`, macOS DMG/ZIP (x64 and arm64), Rescue ISO, manifests, and SHA256SUMS are present.
- [ ] Package verifier confirms core/tool hashes, CSP, air-gapped declaration, ASAR integrity, and all Electron fuses.
- [ ] External-tool capability reports and the generated lock were reviewed; every bundled tool has exact provenance, license, platform, version, SHA-256, `networkAllowed: false`, and explicit redistribution approval.
- [ ] `node packaging/scripts/verify-release-set.mjs <release-directory>` succeeds before publication.
- [ ] Signing/notarization status is stated; private signing material remains in protected local certificate/keychain storage and is never committed.
- [ ] BOSS 10 install and VM Rescue boot checks have documented results or a capability-based refusal.
- [ ] Synthetic SIH demo runs end-to-end and report limitations match the published wording.
- [ ] Release assets are downloaded once after publication and rechecked against SHA256SUMS.
