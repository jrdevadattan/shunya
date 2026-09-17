use recovery_domain::{EncryptedState, RuntimeMode, ScanPreset, SourceHealth};
use safety_policy::{
    Decision, DestinationScenario, SourceScenario, assess_source, validate_destination,
};

fn codes(findings: &[recovery_domain::CapabilityFinding]) -> Vec<&str> {
    findings
        .iter()
        .map(|finding| finding.code.as_str())
        .collect()
}

#[test]
fn active_system_disk_requires_rescue_for_deep_scan() {
    let result = assess_source(
        SourceScenario {
            system_disk: true,
            ..Default::default()
        },
        ScanPreset::Full,
        RuntimeMode::Installed,
    );
    assert!(codes(&result.findings).contains(&"ACTIVE_SYSTEM_DISK_REQUIRES_RESCUE"));
}

#[test]
fn same_device_and_insufficient_destinations_are_blocked() {
    let same = validate_destination(DestinationScenario {
        same_physical_device: true,
        ..Default::default()
    });
    assert_eq!(same.decision, Decision::Blocked);
    assert_eq!(same.findings[0].code, "SAME_PHYSICAL_DEVICE");
    let small = validate_destination(DestinationScenario {
        free_bytes: 10,
        required_bytes: 11,
        ..Default::default()
    });
    assert_eq!(small.decision, Decision::Blocked);
    assert!(codes(&small.findings).contains(&"INSUFFICIENT_SPACE"));
}

#[test]
fn policy_matrix_orders_hard_blocks_before_advisories() {
    let source = assess_source(
        SourceScenario {
            identity_changed: true,
            requires_write: true,
            encrypted_state: EncryptedState::Locked,
            health: SourceHealth::Failing,
            experimental_filesystem: true,
            ..Default::default()
        },
        ScanPreset::Full,
        RuntimeMode::Installed,
    );
    assert_eq!(source.decision, Decision::Blocked);
    assert_eq!(
        codes(&source.findings),
        vec![
            "SOURCE_IDENTITY_CHANGED",
            "SOURCE_WRITE_REQUIRED",
            "SOURCE_LOCKED",
            "FAILING_SOURCE",
            "EXPERIMENTAL_FILESYSTEM"
        ]
    );
}

#[test]
fn read_only_destination_blocks_while_network_destination_warns() {
    let blocked = validate_destination(DestinationScenario {
        writable: false,
        ..Default::default()
    });
    assert_eq!(blocked.decision, Decision::Blocked);
    let warning = validate_destination(DestinationScenario {
        network: true,
        ..Default::default()
    });
    assert_eq!(warning.decision, Decision::Warning);
    assert!(warning.requires_acknowledgement);
}
