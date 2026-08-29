# Rescue Mode operator guide

1. Verify the ISO SHA-256 and manifest on a trusted machine.
2. Boot the prepared USB/ISO using UEFI or legacy BIOS; confirm the header says **Rescue Mode**.
3. Keep networking disabled unless an Advanced operation explicitly requires it.
4. Attach the source and a different writable destination. Confirm serial, capacity, sector size, and source read-only status.
5. Use RAW/E01 acquisition for a healthy device. Use the damaged-device first pass when health or reads are unstable.
6. Never select the source physical device as the case or image destination.
7. Preserve the case, image, mapfile, report, and checksums together. Shut down before disconnecting devices.

The live session disables swap, desktop automounting, and networking by default. Failure of application/package hashes blocks launch.
