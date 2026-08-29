#!/bin/sh
set -eu
test "${RECOVERY_BOSS10_VM:-}" = "1" || { echo "skipped: run inside the designated BOSS 10 VM"; exit 0; }
DEB=${1:?usage: boss10-install.sh recovery-platform.deb}
sudo dpkg -i "$DEB" || sudo apt-get -f install -y
recovery-platform --version
test -x /usr/lib/sih-recovery-platform/resources/recoveryd || test -x /opt/SIH-Recovery-Platform/resources/recoveryd
echo "BOSS 10 package installation smoke test passed"
