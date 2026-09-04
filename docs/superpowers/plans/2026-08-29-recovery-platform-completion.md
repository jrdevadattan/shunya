# Recovery Platform Completion Plan

**Spec:** `docs/specs/recovery-module.md`

**Goal:** Convert the existing tested component library and Electron demonstration shell into a real end-to-end recovery application. Preserve the read-only source invariant, typed capability refusals, offline profile, and deterministic audit/report behavior.

## Global constraints

- Never write to a recovery source or use a source physical device as an export destination.
- The daemon is the authority for cases, sources, jobs, artifacts, exports, reports, and capability results; the renderer must not invent forensic data.
- External tools are executed without a shell and only after manifest/capability validation.
- Unsupported tools, filesystems, hardware, permissions, and platforms return explicit typed limitations rather than simulated success.
- Use test-driven development and preserve existing public contracts unless a failing integration test proves a contract gap.
- No CI/CD is added. Validation and packaging are manual on native hosts.

### Task 1: Complete daemon APIs and recovery orchestration

Add integration tests that create a case around deterministic RAW fixtures, add/assess a source, run a recovery job through preflight, partition scan, metadata recovery, carving, validation, indexing and completion, then query artifacts. Implement the orchestration and daemon methods for source assessment, job status/events, artifact query/get/preview metadata, export, and report generation. Real engine adapters must be used when their capability is available; otherwise the job records a typed limitation and continues only where the selected recovery goal permits it.

### Task 2: Replace renderer fixtures with live application state

Add renderer integration/E2E tests that prove case, source assessment, partition, job progress, results pagination, preview policy, export, report and memory screens display daemon responses and errors. Remove hard-coded forensic findings, hashes, counts, partitions, results, and simulated completion buttons. Keep only explicit test fixtures under test code.

### Task 3: Implement external-tool discovery and release capability manifests

Add tests for native tool discovery, version capture, hash pinning, platform matching, missing tools, mismatched hashes and forbidden network-enabled entries. Provide a manual manifest-generation workflow for TestDisk/PhotoRec, Sleuth Kit, libewf, YARA-X and Volatility. Packages may include only redistributable verified files. A missing non-redistributable tool must be reported as unavailable, never silently claimed as bundled.

### Task 4: Close platform, fault and security validation gaps

Run the complete TypeScript and Rust suites, packaged Electron E2E, million-row performance gate, package verifier, virtual-device smoke test, BOSS installation test and Rescue BIOS/UEFI boot checks on available native hosts. Add regression tests for any discovered defect. Record capability-based refusals for environments that are genuinely unavailable. Validate Windows and Debian release packages; macOS x64/arm64 requires native macOS hardware and signing/notarization requires operator credentials.

### Task 5: Finish release engineering and delivery

Run the complete release-set verifier, code review and native package checks. Update documentation and release notes so availability, signing and unsupported capabilities match the binaries. Commit and push only after fresh verification. Publishing or replacing public release assets is an external side effect and requires the user's explicit instruction at that point.
