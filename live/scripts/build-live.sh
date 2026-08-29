#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
VERSION=${RECOVERY_VERSION:-0.1.0}
OUTPUT="$ROOT/dist/rescue"
command -v lb >/dev/null || { echo "live-build is required (run this script on Debian Bookworm)" >&2; exit 2; }
mkdir -p "$OUTPUT"
cd "$ROOT/live"
lb clean --purge
./auto/config
lb build
ISO="$OUTPUT/recovery-rescue-${VERSION}-x86_64.iso"
ISO_NAME=$(basename "$ISO")
cp live-image-amd64.hybrid.iso "$ISO"
(cd "$OUTPUT" && sha256sum "$ISO_NAME") >"$ISO.sha256"
SIZE=$(wc -c <"$ISO" | tr -d ' ')
HASH=$(sha256sum "$ISO" | cut -d' ' -f1)
printf '{"schemaVersion":1,"artifact":"%s","bytes":%s,"sha256":"%s","runtimeMode":"rescue"}\n' "$ISO_NAME" "$SIZE" "$HASH" >"$OUTPUT/recovery-rescue-${VERSION}-x86_64.manifest.json"
