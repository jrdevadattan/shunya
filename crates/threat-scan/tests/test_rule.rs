use recovery_domain::ThreatStatus;
use std::fs;
use tempfile::tempdir;
use threat_scan::ThreatScanner;

#[test]
fn harmless_platform_test_pattern_is_persisted_as_potential_threat() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("fixture.bin");
    fs::write(&path, b"prefix SIH_RECOVERY_TEST_PATTERN_2026 suffix").unwrap();
    let outcome = ThreatScanner::default().scan(&path).unwrap();
    assert_eq!(outcome.status, ThreatStatus::PotentialThreat);
    assert_eq!(
        outcome.matched_rules,
        vec!["SIH_Recovery_Platform_Test_2026"]
    );
    assert!(!outcome.scanner_version.is_empty());
}
