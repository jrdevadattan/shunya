# Technical Deep‑Dive (for when judges go deep)

## Architecture at a glance

```
┌────────────────────────── SHUNYA desktop (Electron) ──────────────────────────┐
│  Renderer (React/TS)  ──typed, sandboxed IPC──►  Main process (Node/TS)         │
│   • Recovery UI, live progress, results          • window hardening (Fuses)     │
│   • "Erase a device" UI                          • Secure‑erase module (CSPRNG) │
│                                                  • spawns + SHA‑256‑verifies ▼  │
└───────────────────────────────────────────────────────────────────────────────┘
                                                   ┌───────────────────────────┐
                          stdio JSON‑RPC  ◄────────►│  recoveryd (Rust core)    │
                                                   │  read‑only recovery engine │
                                                   │  carving · hashing · YARA‑X│
                                                   │  case store (SQLite)       │
                                                   └───────────────────────────┘
```

- The **Rust daemon** does all evidence I/O — memory‑safe parsing of untrusted disk data. The main process **verifies the daemon's SHA‑256** before launching it.
- **Electron Fuses** are on: `OnlyLoadAppFromAsar`, ASAR integrity validation, `RunAsNode` off, no `NODE_OPTIONS`, cookie encryption — a hardened shell.
- **Offline by design:** no network calls, no telemetry, no auto‑update.

## Recovery pipeline (what runs during a scan)

1. **Preflight** — re‑validate the source and compute its **SHA‑256** (baseline for chain of custody).
2. **Partition discovery** — native **GPT/MBR** parsing (no third‑party binary).
3. **Metadata scan** — *(roadmap: Sleuth Kit)* — currently reports "unavailable" honestly.
4. **Carving** — **multi‑format signature carving** from unallocated space. The operator picks file families (images, documents, archives, audio/video, databases, executables); each hit is bounded by the format's own structure (JPEG marker walk to the real EOI, PNG chunk table, ZIP central directory, MP4 box walk, PE section table, SQLite page count…) — never by guessing a length. If a verified **PhotoRec** binary is vendored, it runs sandboxed instead and its DFXML byte runs are mapped onto the same evidence model.
5. **Validation** — each carved file is validated per format → `complete_validated` / partial / corrupt; executables are never previewed.
6. **Threat scan** — **real YARA‑X** scans every recovered file; matches → `potential_threat`, preview blocked.
7. **Indexing** — results written to a **SQLite** result index (millions‑of‑rows target).
8. **Review / Complete** — jobs are **checkpointed**: pause, resume, cancel, and survive a restart.

Recovery **never writes to the source**; it re‑hashes the source **after** the run to prove it's unchanged.

## Secure‑erase (CSPRNG overwrite) mechanics

- **Enumerate** physical disks (Windows `Get-Disk`/`Get-PhysicalDisk`, Linux `lsblk`) and flag the **system disk** (never eligible) + **removable** media.
- **Gate** (defence in depth, re‑checked in the main process): confirmation must equal the device path; system disk blocked; non‑removable blocked; size sane.
- **Overwrite:** a single sequential pass of an **AES‑256‑CTR keystream** (encrypting zeros → raw keystream) over every sector. The transient key/IV exist only in memory and are **zeroed** after; nothing is persisted. CTR (not GCM) — an auth tag is meaningless when destroying data.
- **Windows:** the target disk is taken **offline** (dismounts its volumes) before the raw write; **Linux:** partitions are unmounted. Requires elevation.
- **Audit:** every step appends a tamper‑evident **NDJSON** record (device, model, serial, bytes, outcome).
- **Standard:** an overwrite‑based **NIST 800‑88 Clear**. Firmware **Sanitize** (ATA Secure Erase / NVMe Sanitize) is the roadmap for **Purge**.

## Chain of custody / trust model

- Source opened **read‑only**; **SHA‑256 before + after**.
- Every action logged to the **case store** against a case number + operator.
- Each recovered file carries a **SHA‑256**; exports are **re‑verified** on arrival and refuse to write into the evidence image or the case workspace.
- Recovered content is **quarantined** — never auto‑opened; active/unsafe types are preview‑blocked.
- A **JSON + Markdown report** documents tools/versions, method counts, and **explicit limitations**.

## Honest capability matrix (say this if pushed)

| Capability | State |
|---|---|
| RAW/dd image recovery, GPT/MBR, multi‑format carving (21 format groups, selectable families) | ✅ working |
| PhotoRec adapter (sandboxed, hash‑verified, DFXML byte runs) — runs when a verified binary is vendored | ✅ wired (binary not bundled: GPL redistribution review pending) |
| SHA‑256 chain of custody, verified export, report | ✅ working |
| Real YARA‑X threat scanning + quarantine | ✅ working |
| CSPRNG flash wipe (NIST Clear) + audit, system‑disk protection | ✅ working |
| Ed25519‑signed, verifiable, tamper‑evident certificate (erase + recovery) | ✅ working |
| Sleuth Kit metadata recovery, Volatility memory analysis | 🚧 roadmap (shown as "unavailable", never faked) |
| NVMe Sanitize (Purge‑level assurance) | 🚧 roadmap (hooks in place) |
| Linux / macOS / Rescue‑ISO builds | 🚧 roadmap (architecture ready) |

## Stack summary

- **Core:** Rust (recovery daemon, secure‑erase engine in TS/Node, `yara-x`, `sha2`, SQLite).
- **App:** Electron + React + TypeScript, Vite, hardened with Electron Fuses.
- **Packaging:** Electron Forge → Windows Squirrel installer; the daemon is staged with a pinned SHA‑256.
