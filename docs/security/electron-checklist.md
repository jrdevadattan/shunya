# Electron release checklist

- Electron 44 / Node 24 toolchain is lockfile-pinned.
- Renderer uses `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, and `webSecurity: true`.
- Packaged DevTools are disabled based on `app.isPackaged`, not an operator-controlled environment variable.
- Application content loads through `recovery://app`, never `file://` or remote HTTP.
- CSP is `default-src 'self'`; scripts and connections are local-only.
- Navigation, new windows, and all permission requests are denied.
- Every IPC sender and method is validated; raw Electron APIs are not bridged.
- NDJSON/RPC frames are schema-checked and capped at 8 MiB on both sides.
- Run-as-Node, NODE_OPTIONS, CLI inspection, and file-protocol privileges are fused off.
- Embedded ASAR integrity and ASAR-only application loading are fused on.
- Signing identities stay in protected certificate/keychain storage on the native build host; unsigned artifacts are clearly identified.
- Telemetry and automatic update/network activity are absent in the air-gapped profile.
