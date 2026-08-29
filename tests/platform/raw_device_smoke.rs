// Real-device smoke tests are capability-gated and must only target CI-created loop, VHD, or disk-image fixtures.
#[test]
fn requires_explicit_virtual_device_fixture() {
    if std::env::var_os("RECOVERY_TEST_VIRTUAL_DEVICE").is_none() {
        eprintln!("skipped: RECOVERY_TEST_VIRTUAL_DEVICE is not configured");
        return;
    }
}
