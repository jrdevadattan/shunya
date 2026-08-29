# Third-party notices

This project can integrate with separately packaged forensic tools. A release may include only tools recorded in `tools/manifests/tools.lock.json`, after license and checksum review.

- The Sleuth Kit: CPL-1.0 and component-specific mixed licensing.
- TestDisk and PhotoRec: GPL-2.0.
- libewf: LGPL-3.0-or-later.
- YARA-X: BSD-3-Clause.
- GNU ddrescue: GPL-2.0-or-later.
- Memory-analysis tools: distributed separately and governed by their respective terms.

These notices do not replace legal review. The empty production tool lockfile means the source tree does not silently claim to bundle or verify binaries that are not present.

E01/Ex01 support invokes `ewfinfo`, `ewfverify`, `ewfexport`, and `ewfacquire` only when a release-specific checksum-pinned tool manifest provides them. The synthetic files under `testdata/generated` test segment discovery and are not valid evidence images.
