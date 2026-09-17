#!/bin/sh
set -eu
OUT=${1:?output image path required}
truncate -s 80M "$OUT"
printf 'label: dos\nunit: sectors\n\nstart=2048,size=65536,type=c\n' | sfdisk "$OUT" >/dev/null
dd if=/dev/zero of="$OUT" bs=512 count=1 conv=notrunc status=none
