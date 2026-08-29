use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tempfile::TempDir;
use tool_runner::{
    DiscoveryStatus, NativeToolCandidate, ToolDiscoveryRequest, current_platform, discover_tools,
};

struct DiscoveryFixture {
    _root: TempDir,
    tools_root: PathBuf,
    executable: PathBuf,
}

impl DiscoveryFixture {
    fn new() -> Self {
        let root = TempDir::new().unwrap();
        let tools_root = root.path().join("tools");
        let relative_path = PathBuf::from("fixture/tool-runner-fixture");
        let executable = tools_root.join(&relative_path);
        std::fs::create_dir_all(executable.parent().unwrap()).unwrap();
        std::fs::copy(
            PathBuf::from(env!("CARGO_BIN_EXE_tool-runner-fixture")),
            &executable,
        )
        .unwrap();
        Self {
            _root: root,
            tools_root,
            executable,
        }
    }

    fn candidate(&self) -> NativeToolCandidate {
        NativeToolCandidate {
            id: "fixture".into(),
            version: "1.2.3".into(),
            license: "Apache-2.0".into(),
            origin: "https://example.invalid/fixture-release".into(),
            platform: current_platform().into(),
            relative_path: PathBuf::from("fixture/tool-runner-fixture"),
            expected_sha256: sha256(&self.executable),
            version_arguments: vec!["version".into()],
            network_allowed: false,
            redistribution_allowed: true,
        }
    }

    async fn discover(&self, candidate: NativeToolCandidate) -> tool_runner::ToolDiscoveryReport {
        discover_tools(
            &self.tools_root,
            ToolDiscoveryRequest {
                platform: current_platform().into(),
                candidates: vec![candidate],
                probe_timeout: Duration::from_secs(2),
            },
        )
        .await
    }
}

#[tokio::test]
async fn verified_native_tool_captures_version_hash_license_origin_and_platform() {
    let fixture = DiscoveryFixture::new();
    let expected_hash = sha256(&fixture.executable);

    let report = fixture.discover(fixture.candidate()).await;

    assert_eq!(report.capabilities[0].status, DiscoveryStatus::Available);
    assert_eq!(
        report.capabilities[0].detected_version.as_deref(),
        Some("fixture-tool 1.2.3")
    );
    assert_eq!(
        report.capabilities[0].actual_sha256.as_deref(),
        Some(expected_hash.as_str())
    );
    assert_eq!(report.manifest.tools.len(), 1);
    let entry = &report.manifest.tools[0];
    assert_eq!(entry.version, "1.2.3");
    assert_eq!(entry.license, "Apache-2.0");
    assert_eq!(entry.origin, "https://example.invalid/fixture-release");
    assert_eq!(entry.platform, current_platform());
    assert_eq!(entry.sha256, expected_hash);
    assert!(entry.redistribution_allowed);
    assert!(!entry.network_allowed);
}

#[tokio::test]
async fn missing_native_tool_is_typed_unavailable_and_not_manifested() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.relative_path = PathBuf::from("missing/tool");

    let report = fixture.discover(candidate).await;

    assert_eq!(report.capabilities[0].status, DiscoveryStatus::Missing);
    assert!(report.capabilities[0].actual_sha256.is_none());
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn platform_mismatch_is_typed_unavailable_and_not_probed() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.platform = "unsupported-test-platform".into();

    let report = fixture.discover(candidate).await;

    assert_eq!(
        report.capabilities[0].status,
        DiscoveryStatus::PlatformMismatch
    );
    assert!(report.capabilities[0].detected_version.is_none());
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn hash_mismatch_is_typed_unavailable_and_never_version_probed() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.expected_sha256 = "0".repeat(64);

    let report = fixture.discover(candidate).await;

    assert_eq!(report.capabilities[0].status, DiscoveryStatus::HashMismatch);
    assert_eq!(
        report.capabilities[0].actual_sha256.as_deref(),
        Some(sha256(&fixture.executable).as_str())
    );
    assert!(report.capabilities[0].detected_version.is_none());
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn version_mismatch_is_typed_unavailable_and_not_manifested() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.version = "9.9.9".into();

    let report = fixture.discover(candidate).await;

    assert_eq!(
        report.capabilities[0].status,
        DiscoveryStatus::VersionMismatch
    );
    assert_eq!(
        report.capabilities[0].detected_version.as_deref(),
        Some("fixture-tool 1.2.3")
    );
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn network_enabled_candidate_is_forbidden_before_file_access() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.network_allowed = true;
    candidate.relative_path = PathBuf::from("missing/tool");

    let report = fixture.discover(candidate).await;

    assert_eq!(
        report.capabilities[0].status,
        DiscoveryStatus::NetworkForbidden
    );
    assert!(report.capabilities[0].actual_sha256.is_none());
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn unapproved_redistribution_is_typed_unavailable_and_not_manifested() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.redistribution_allowed = false;

    let report = fixture.discover(candidate).await;

    assert_eq!(
        report.capabilities[0].status,
        DiscoveryStatus::RedistributionForbidden
    );
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn missing_license_is_invalid_metadata_and_not_manifested() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.license.clear();

    let report = fixture.discover(candidate).await;

    assert_eq!(
        report.capabilities[0].status,
        DiscoveryStatus::InvalidMetadata
    );
    assert!(report.manifest.tools.is_empty());
}

fn sha256(path: &Path) -> String {
    Sha256::digest(std::fs::read(path).unwrap())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}
