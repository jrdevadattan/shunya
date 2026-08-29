# Recovery limitations

- SSD TRIM, secure erase, overwriting, and physical media damage can make data permanently unrecoverable.
- Signature carving can recover content but does not restore original filenames, folders, timestamps, or reliable ownership.
- APFS, ReFS, RAID, LVM, hybrid partitioning, and other experimental/complex layouts may be detected but are not automatically assembled or fully recovered.
- Locked encryption requires the operator’s authorized keys; the product does not bypass encryption.
- Partial, fragmented, compressed, sparse, or overwritten files may fail validation or contain missing bytes.
- Memory capture changes the running system and cannot be perfectly non-invasive. macOS live-memory capture is unsupported in this MVP.
- Installed Mode runs on—and therefore trusts—the installed operating system. It is not equivalent to a clean Rescue Mode environment.
- A successful validator, hash, or threat scan is evidence about the processed bytes, not a guarantee that a file is safe or complete.
