#!/bin/sh
set -eu
OUT=${1:?output image path required}
command -v mkfs.vfat >/dev/null || { echo "mkfs.vfat is required" >&2; exit 2; }
truncate -s 64M "$OUT"
mkfs.vfat -F 32 -i 26149001 -n RECOVERY_FAT "$OUT" >/dev/null
