# Release-candidate checklist

- [ ] Version/tag and tracked release notes match; `git diff --exit-code` and `git diff --cached --exit-code` are clean at the reviewed commit, and any explicitly excluded user-owned untracked files are not release inputs.
- [ ] `pnpm lint`, `pnpm typecheck`, unit/integration/fault/security/performance tests, full Rust clippy/nextest, and packaged Electron E2E pass.
- [ ] Follow `docs/operations/manual-release.md`; each package is built on its native operating system from the same reviewed commit.
- [ ] The approved release scope is recorded. Complete releases include Windows Setup, Linux `.deb`, macOS DMG/ZIP (x64 and arm64), Rescue ISO, manifests, and SHA256SUMS; the approved Windows-x64-only `v0.2.0` release includes the Setup EXE, full NUPKG, `SHA256SUMS`, and `release-manifest.json`.
- [ ] Package verifier confirms core/tool hashes, CSP, air-gapped declaration, ASAR integrity, and all Electron fuses.
- [ ] External-tool capability reports and the generated lock were reviewed; every bundled tool has exact provenance, license, platform, version, SHA-256, `networkAllowed: false`, and explicit redistribution approval.
- [ ] The matching gate succeeds before publication: `node packaging/scripts/verify-release-set.mjs <release-directory>` for the complete multi-platform set, or `node packaging/scripts/verify-release-set.mjs --profile windows-x64 dist/release/v0.2.0` only for the approved Windows-x64-only `v0.2.0` scope.
- [ ] Signing/notarization status is stated; private signing material remains in protected local certificate/keychain storage and is never committed.
- [ ] BOSS 10 install and VM Rescue boot checks have documented results or a capability-based refusal.
- [ ] Synthetic SIH demo runs end-to-end and report limitations match the published wording.
- [ ] Release assets are downloaded once after publication and rechecked against SHA256SUMS.
