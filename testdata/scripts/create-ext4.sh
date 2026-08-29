#!/bin/sh
set -eu
OUT=${1:?output image path required}
truncate -s 64M "$OUT"
mke2fs -q -t ext4 -U 26149001-2614-4001-8001-261490012614 -L RECOVERY_EXT4 -E lazy_itable_init=0,lazy_journal_init=0 "$OUT"
