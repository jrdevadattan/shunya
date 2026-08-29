# Deterministic forensic test corpus

The small corpus is generated locally and contains no personal or production evidence. `create-carving-fixture.py` is byte-reproducible and writes its own SHA-256 truth manifest. Filesystem-image scripts use fixed sizes, labels, UUIDs, and volume IDs where the tool permits them; NTFS/exFAT fields that remain host-generated are compared through normalized logical truth rather than whole-image hashes.

CI groups are `unit`, `integration`, `fault`, `security`, `platform`, and `e2e`. Physical-device tests require a loop device, VHD, or disk-image capability variable and never select a host disk.

## Fault coverage

Automated lanes cover stable-ID replacement, reconnect checkpoints, unavailable/full destinations, daemon restart, tool crash/malformed output, corrupt case metadata, split-segment gaps, and injected read-error ranges. Network destinations are never an implicit recovery destination; an explicit remote-export adapter must add bounded timeouts before it can be enabled.

## NIST CFReDS lane

NIST CFReDS images are not downloaded on every pull request. A scheduled/manual validation lane may use the published deleted-file and disk-image datasets after recording the dataset URL, acquisition date, upstream checksum, redistribution terms, expected findings, and local secure storage location. Results are retained as reports and hashes, not by committing large external images.
