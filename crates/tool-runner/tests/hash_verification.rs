mod support;

use support::fixture_registry;
use tool_runner::{ToolManifest, ToolManifestEntry, ToolRegistry, current_platform};

#[test]
fn verifies_fixture_hash_and_rejects_tampering() {
    let fixture = fixture_registry();
    assert!(fixture.registry.load_and_verify("fixture").is_ok());
    std::fs::write(&fixture.executable, b"tampered").unwrap();
    assert!(fixture.registry.load_and_verify("fixture").is_err());
}

#[test]
fn registry_refuses_network_enabled_manifest_entry() {
    let root = tempfile::tempdir().unwrap();
    let result = ToolRegistry::from_manifest(root.path(), manifest_entry(true, true));

    assert!(
        result
            .err()
            .unwrap()
            .to_string()
            .contains("network-enabled")
    );
}

#[test]
fn registry_refuses_manifest_entry_without_redistribution_approval() {
    let root = tempfile::tempdir().unwrap();
    let result = ToolRegistry::from_manifest(root.path(), manifest_entry(false, false));

    assert!(result.err().unwrap().to_string().contains("redistribution"));
}

fn manifest_entry(network_allowed: bool, redistribution_allowed: bool) -> ToolManifest {
    ToolManifest {
        manifest_version: 1,
        tools: vec![ToolManifestEntry {
            id: "fixture".into(),
            version: "1".into(),
            license: "test-only".into(),
            origin: "test-fixture".into(),
            platform: current_platform().into(),
            relative_path: "fixture".into(),
            sha256: "0".repeat(64),
            network_allowed,
            redistribution_allowed,
        }],
    }
}
