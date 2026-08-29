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

#[test]
fn registry_refuses_invalid_sha_on_off_platform_entry() {
    let root = tempfile::tempdir().unwrap();
    let mut entry = valid_entry("fixture", off_platform());
    entry.sha256 = "not-a-sha256".into();

    let error = ToolRegistry::from_manifest(root.path(), manifest(vec![entry]))
        .err()
        .expect("off-platform SHA must be validated");

    assert!(error.to_string().contains("invalid SHA-256"));
}

#[test]
fn registry_refuses_unsafe_path_on_off_platform_entry() {
    let root = tempfile::tempdir().unwrap();
    let mut entry = valid_entry("fixture", off_platform());
    entry.relative_path = "../escape".into();

    let error = ToolRegistry::from_manifest(root.path(), manifest(vec![entry]))
        .err()
        .expect("off-platform path must be validated");

    assert!(error.to_string().contains("unsafe path"));
}

#[test]
fn registry_refuses_unsupported_platform_before_filtering() {
    let root = tempfile::tempdir().unwrap();
    let entry = valid_entry("fixture", "solaris-x64");

    let error = ToolRegistry::from_manifest(root.path(), manifest(vec![entry]))
        .err()
        .expect("platform enum must be validated");

    assert!(error.to_string().contains("unsupported platform"));
}

#[test]
fn registry_refuses_duplicate_id_and_platform_off_host() {
    let root = tempfile::tempdir().unwrap();
    let entry = valid_entry("fixture", off_platform());

    let error = ToolRegistry::from_manifest(root.path(), manifest(vec![entry.clone(), entry]))
        .err()
        .expect("off-platform duplicates must be validated");

    assert!(error.to_string().contains("duplicate tool ID and platform"));
}

#[test]
fn registry_allows_same_id_for_different_platforms() {
    let root = tempfile::tempdir().unwrap();
    let result = ToolRegistry::from_manifest(
        root.path(),
        manifest(vec![
            valid_entry("fixture", current_platform()),
            valid_entry("fixture", off_platform()),
        ]),
    );

    assert!(result.is_ok());
}

fn manifest_entry(network_allowed: bool, redistribution_allowed: bool) -> ToolManifest {
    let mut entry = valid_entry("fixture", current_platform());
    entry.network_allowed = network_allowed;
    entry.redistribution_allowed = redistribution_allowed;
    manifest(vec![entry])
}

fn manifest(tools: Vec<ToolManifestEntry>) -> ToolManifest {
    ToolManifest {
        manifest_version: 1,
        tools,
    }
}

fn valid_entry(id: &str, platform: &str) -> ToolManifestEntry {
    ToolManifestEntry {
        id: id.into(),
        version: "1".into(),
        license: "test-only".into(),
        origin: "test-fixture".into(),
        platform: platform.into(),
        relative_path: "fixture".into(),
        sha256: "0".repeat(64),
        network_allowed: false,
        redistribution_allowed: true,
    }
}

fn off_platform() -> &'static str {
    if current_platform() == "windows-x64" {
        "linux-x64"
    } else {
        "windows-x64"
    }
}
