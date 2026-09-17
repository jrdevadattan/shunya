# Recovery Platform threat model

The renderer is untrusted; the Electron main process is a narrow broker; `recoveryd` owns case operations; the privileged helper owns only allowlisted read-only raw-device handles; third-party tools run as checksum-pinned child processes; source media and recovered bytes are hostile.

| Threat | Boundary and control | Automated evidence | Residual risk |
|---|---|---|---|
| Malicious disk metadata | Parsers use bounded reads, typed records, and no renderer HTML injection | corpus, parser, malicious-metadata tests | New filesystem parser bugs remain possible |
| Malicious recovered files | quarantine, magic validation, bounded worker previews, no system-app open | unsafe-preview and archive-limit tests | A decoder vulnerability may still exist |
| Compromised installed OS | Rescue Mode, hashes, package signatures where configured | package/live integrity tests | Host firmware and kernel remain trusted |
| Fake device at the same path | stable hardware identity and sample fingerprint revalidation | source-disconnect test | Indistinguishable controller spoofing |
| Tool replacement | platform/architecture lockfile and SHA-256 before every launch | tool-runner and package verifier | Build/signing infrastructure compromise |
| Renderer IPC abuse | custom protocol, sender validation, method allowlist, schemas, 8 MiB frames | IPC and frame fuzz tests | Main-process implementation defects |
| Export traversal | normalization, reserved-name handling, root containment, collision suffixes | traversal/collision tests | Destination filesystem semantic differences |
| Resource exhaustion | bounded queues/logs/previews/archive ratios and cursor paging | million-row, oversized line, archive tests | Extremely slow but valid media |
| Case tampering | SQLite integrity errors, manifests, append-only audit mirror, source hashes | corrupt-case/report tests | No PKI signature in MVP |
| Accidental source writes | read-only APIs only, no generic helper command, same-device block, no automount | helper allowlist, acquisition, live verification | OS/driver bugs outside application control |
