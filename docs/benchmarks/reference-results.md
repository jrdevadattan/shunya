# Reference performance results

Performance gates are engineering regressions, not recovery-speed marketing claims. Results vary with media, damage, selected file families, encryption, filesystem state, CPU, and destination storage.

Reference run: Windows x64 development workstation, release Rust binaries, synthetic local files, 29 August 2026.

| Workload | Gate / recorded method |
|---|---|
| RAW acquisition + SHA-256 + checkpoint | 20.8 MiB/s for the 32 MiB deterministic debug-test fixture (1.535 s); minimum regression floor 1 MiB/s |
| Metadata scan | filesystem corpus records elapsed time per fixture; no cross-device claim until BOSS/Windows native-host baselines are retained |
| Carving | record bytes, selected families, elapsed time, CPU and tool version; broad family sets are not compared with narrow sets |
| Hashing | included in acquisition gate and export post-copy verification |
| One-million-row first-page search | 911.1 µs query after generating one million SQLite/FTS rows; corpus setup and test total 49.54 s; query hard ceiling 5 seconds |
| Renderer responsiveness | four result-filter transitions under 2 seconds total and at most two Chromium long tasks |
| Large result review memory | collect Electron process working set on each native release host; release is blocked on unbounded growth, not an invented fixed marketing number |

Run `cargo test -p performance-tests --test scan_throughput -- --nocapture` and `cargo test -p result-index --test million_rows -- --nocapture` to record machine-specific values.
