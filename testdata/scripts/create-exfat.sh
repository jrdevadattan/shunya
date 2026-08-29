#!/bin/sh
set -eu
OUT=${1:?output image path required}
command -v mkfs.exfat >/dev/null || { echo "mkfs.exfat is required" >&2; exit 2; }
truncate -s 64M "$OUT"
mkfs.exfat -L RECOVERY_EXFAT "$OUT" >/dev/null
