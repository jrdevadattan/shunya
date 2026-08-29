# Release-candidate checklist

- [ ] Version/tag and release notes match; workspace and lockfiles are clean.
- [ ] `pnpm lint`, `pnpm typecheck`, unit/integration/fault/security/performance tests, full Rust clippy/nextest, and packaged Electron E2E pass.
- [ ] Windows Setup, Linux `.deb`, macOS DMG/ZIP (x64 and arm64), Rescue ISO, manifests, and SHA256SUMS are present.
- [ ] Package verifier confirms core/tool hashes, CSP, air-gapped declaration, ASAR integrity, and all Electron fuses.
- [ ] Signing/notarization status is stated; private signing material exists only in CI secret storage.
- [ ] BOSS 10 install and VM Rescue boot checks have documented results or a capability-based refusal.
- [ ] Synthetic SIH demo runs end-to-end and report limitations match the published wording.
- [ ] Release assets are downloaded once after publication and rechecked against SHA256SUMS.
