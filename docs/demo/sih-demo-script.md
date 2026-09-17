# SIH 26149 demonstration script

Use only the prepared synthetic fixtures and preflight every checksum.

1. Launch Installed Mode on BOSS 10 or Windows and point out the air-gapped runtime badge.
2. Create a case with operator and reference metadata.
3. Open the prepared NTFS fixture; confirm its stable identity and unchanged source hash.
4. Run Quick Scan and show the deleted PDF recovered as `/Finance/2025/report.pdf`.
5. Run Full Scan and show a carved JPEG labelled **Original name unavailable**.
6. Open Advanced Details and show source byte ranges, recovery method/tool version, state, and SHA-256.
7. Select the YARA-X test match and show that preview is blocked.
8. Export the two safe files to a different destination; show post-copy SHA-256 verification and collision handling.
9. Start a scan, terminate the app, reopen it, and resume from the persisted checkpoint.
10. Boot the prepared Rescue ISO VM; show networking/swap/automount off and image a read-only fixture disk to another disk.
11. Interrupt the damaged-media first pass, then resume from the same ddrescue mapfile and show unreadable ranges.
12. Open the memory fixture and show typed process and network tables without mixing them into disk results.
13. Generate JSON and Markdown recovery reports; read the limitations aloud and re-check source-before/source-after hashes.
