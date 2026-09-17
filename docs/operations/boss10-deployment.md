# BOSS 10 deployment

Verify the `.deb` and checksum from the GitHub release, then install in the approved BOSS 10 environment:

```sh
sha256sum --check SHA256SUMS
sudo dpkg -i recovery-platform_*.deb
sudo apt-get -f install -y
recovery-platform --version
```

Install the polkit policy and privileged helper only from the same verified release. Physical-device tests must use an attached test image/loop device; use Rescue Mode for the active system disk. The package makes no telemetry, update, or background network request.
