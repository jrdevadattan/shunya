#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
LIVE="$ROOT/live"

require_file() { test -f "$1" || { echo "missing required live file: $1" >&2; exit 1; }; }
require_text() { grep -F "$2" "$1" >/dev/null || { echo "missing '$2' in $1" >&2; exit 1; }; }

require_file "$LIVE/auto/config"
require_text "$LIVE/auto/config" 'lb config noauto'
require_text "$LIVE/scripts/build-live.sh" 'lb clean'
require_file "$LIVE/config/package-lists/recovery.list.chroot"
require_file "$LIVE/config/includes.chroot/etc/fstab"
require_file "$LIVE/config/includes.chroot/etc/udev/rules.d/99-recovery-no-automount.rules"
require_file "$LIVE/config/includes.chroot/usr/local/bin/recovery-launch"
require_file "$LIVE/config/hooks/live/020-disable-network-default.hook.chroot"
require_text "$LIVE/config/hooks/live/010-install-recovery-app.hook.chroot" 'install -d -m 0755 /usr/local/libexec'
require_text "$LIVE/config/includes.chroot/etc/udev/rules.d/99-recovery-no-automount.rules" 'UDISKS_IGNORE'
require_text "$LIVE/config/hooks/live/020-disable-network-default.hook.chroot" 'disable NetworkManager.service'
require_text "$LIVE/config/hooks/live/020-disable-network-default.hook.chroot" 'mask udisks2.service'
require_text "$LIVE/config/includes.chroot/usr/local/bin/recovery-launch" 'RECOVERY_RUNTIME_MODE=rescue'
require_text "$LIVE/config/includes.chroot/usr/local/bin/recovery-launch" 'sha256sum --check --strict'
require_text "$LIVE/config/includes.chroot/usr/local/bin/recovery-launch" 'APP=/usr/bin/sih-recovery-platform'
require_text "$LIVE/config/hooks/live/010-install-recovery-app.hook.chroot" 'command -v sih-recovery-platform'
require_text "$LIVE/scripts/build-live.sh" '(cd "$OUTPUT" && sha256sum "$ISO_NAME")'
require_text "$LIVE/config/package-lists/recovery.list.chroot" 'gddrescue'
require_text "$LIVE/config/package-lists/recovery.list.chroot" 'ewf-tools'
require_text "$LIVE/config/package-lists/recovery.list.chroot" 'libglib2.0-bin'
if grep -Ev '^(#|$|proc |tmpfs )' "$LIVE/config/includes.chroot/etc/fstab" | grep . >/dev/null; then
  echo "fstab contains a persistent or writable source mount" >&2; exit 1
fi
echo "Rescue Mode static verification passed"
