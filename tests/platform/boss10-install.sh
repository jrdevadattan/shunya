#!/bin/sh
set -eu
test "${RECOVERY_BOSS10_VM:-}" = "1" || {
  echo "REFUSED: RECOVERY_BOSS10_VM=1 is required inside the designated BOSS 10 VM" >&2
  exit 2
}
test -r /etc/os-release || { echo "REFUSED: /etc/os-release is unavailable" >&2; exit 2; }
. /etc/os-release
case "${ID:-}|${NAME:-}|${PRETTY_NAME:-}" in
  *[Bb][Oo][Ss][Ss]*) ;;
  *) echo "REFUSED: host does not identify itself as BOSS GNU/Linux" >&2; exit 2 ;;
esac
case "${VERSION_ID:-}" in
  10|10.*) ;;
  *) echo "REFUSED: host is not BOSS GNU/Linux 10" >&2; exit 2 ;;
esac
DEB=${1:?usage: boss10-install.sh recovery-platform.deb}
test -f "$DEB" || { echo "package not found: $DEB" >&2; exit 1; }
sudo dpkg -i "$DEB" || sudo apt-get -f install -y
recovery-platform --version
test -x /usr/lib/sih-recovery-platform/resources/recoveryd || test -x /opt/SIH-Recovery-Platform/resources/recoveryd
echo "BOSS 10 package installation smoke test passed"
