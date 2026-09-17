use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tempfile::TempDir;
use tool_runner::{
    DiscoveryStatus, NativeToolCandidate, ToolDiscoveryRequest, current_platform, discover_tools,
};

#[derive(serde::Deserialize)]
struct PortablePathCorpus {
    safe: Vec<String>,
    hazardous: Vec<String>,
}

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

#[tokio::test]
async fn probe_timeout_covers_descendant_inherited_output_pipes() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.version_arguments = vec!["version-with-descendant".into()];

    let result = tokio::time::timeout(
        Duration::from_millis(700),
        discover_tools(
            &fixture.tools_root,
            ToolDiscoveryRequest {
                platform: current_platform().into(),
                candidates: vec![candidate],
                probe_timeout: Duration::from_millis(150),
            },
        ),
    )
    .await;

    assert!(
        result.is_ok(),
        "probe drain outlived the configured timeout"
    );
    assert_eq!(
        result.unwrap().capabilities[0].status,
        DiscoveryStatus::ProbeFailed
    );
}

#[tokio::test]
async fn ancestor_symlink_escape_is_forbidden_before_hash_or_probe() {
    let fixture = DiscoveryFixture::new();
    let outside = fixture._root.path().join("outside");
    std::fs::create_dir_all(&outside).unwrap();
    let outside_executable = outside.join("tool-runner-fixture");
    std::fs::copy(
        PathBuf::from(env!("CARGO_BIN_EXE_tool-runner-fixture")),
        &outside_executable,
    )
    .unwrap();
    create_directory_symlink(&outside, &fixture.tools_root.join("escaped"));
    let mut candidate = fixture.candidate();
    candidate.relative_path = PathBuf::from("escaped/tool-runner-fixture");
    candidate.expected_sha256 = sha256(&outside_executable);

    let report = fixture.discover(candidate).await;

    assert_eq!(
        report.capabilities[0].status,
        DiscoveryStatus::SymlinkForbidden
    );
    assert!(report.capabilities[0].actual_sha256.is_none());
    assert!(report.capabilities[0].detected_version.is_none());
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn version_near_collision_is_not_accepted() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.version_arguments = vec!["near-version".into()];

    let report = fixture.discover(candidate).await;

    assert_eq!(
        report.capabilities[0].status,
        DiscoveryStatus::VersionMismatch
    );
    assert_eq!(
        report.capabilities[0].detected_version.as_deref(),
        Some("fixture-tool 11.2.30")
    );
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn duplicate_ids_are_invalid_before_any_probe() {
    let fixture = DiscoveryFixture::new();
    let mut first = fixture.candidate();
    first.version_arguments = vec!["sleep".into()];
    let second = first.clone();

    let result = tokio::time::timeout(
        Duration::from_millis(300),
        discover_tools(
            &fixture.tools_root,
            ToolDiscoveryRequest {
                platform: current_platform().into(),
                candidates: vec![first, second],
                probe_timeout: Duration::from_secs(5),
            },
        ),
    )
    .await;

    assert!(result.is_ok(), "duplicate candidates were probed");
    let report = result.unwrap();
    assert!(
        report
            .capabilities
            .iter()
            .all(|capability| capability.status == DiscoveryStatus::InvalidMetadata)
    );
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn portable_dot_component_is_rejected_before_discovery_access() {
    let fixture = DiscoveryFixture::new();
    let mut candidate = fixture.candidate();
    candidate.relative_path = PathBuf::from("fixture/./tool-runner-fixture");

    let report = fixture.discover(candidate).await;

    assert_eq!(report.capabilities[0].status, DiscoveryStatus::UnsafePath);
    assert!(report.capabilities[0].actual_sha256.is_none());
    assert!(report.capabilities[0].detected_version.is_none());
    assert!(report.manifest.tools.is_empty());
}

#[tokio::test]
async fn shared_hazardous_corpus_is_rejected_before_discovery_access() {
    let fixture = DiscoveryFixture::new();
    for path in portable_path_corpus().hazardous {
        let mut candidate = fixture.candidate();
        candidate.relative_path = PathBuf::from(&path);

        let report = fixture.discover(candidate).await;

        assert_eq!(
            report.capabilities[0].status,
            DiscoveryStatus::UnsafePath,
            "{path:?}"
        );
        assert!(report.capabilities[0].actual_sha256.is_none(), "{path:?}");
        assert!(
            report.capabilities[0].detected_version.is_none(),
            "{path:?}"
        );
        assert!(report.manifest.tools.is_empty(), "{path:?}");
    }
}

#[tokio::test]
async fn shared_safe_unicode_corpus_remains_discoverable_and_loadable() {
    let fixture = DiscoveryFixture::new();
    let source = PathBuf::from(env!("CARGO_BIN_EXE_tool-runner-fixture"));
    let mut candidates = Vec::new();
    for (index, path) in portable_path_corpus().safe.into_iter().enumerate() {
        let destination = fixture.tools_root.join(&path);
        std::fs::create_dir_all(destination.parent().unwrap()).unwrap();
        std::fs::copy(&source, &destination).unwrap();
        let mut candidate = fixture.candidate();
        candidate.id = format!("safe-{index}");
        candidate.relative_path = PathBuf::from(path);
        candidate.expected_sha256 = sha256(&destination);
        candidates.push(candidate);
    }

    let report = discover_tools(
        &fixture.tools_root,
        ToolDiscoveryRequest {
            platform: current_platform().into(),
            candidates,
            probe_timeout: Duration::from_secs(2),
        },
    )
    .await;

    assert!(
        report
            .capabilities
            .iter()
            .all(|item| item.status == DiscoveryStatus::Available)
    );
    assert!(tool_runner::ToolRegistry::from_manifest(&fixture.tools_root, report.manifest).is_ok());
}

fn sha256(path: &Path) -> String {
    Sha256::digest(std::fs::read(path).unwrap())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(unix)]
fn create_directory_symlink(target: &Path, link: &Path) {
    std::os::unix::fs::symlink(target, link).unwrap();
}

fn portable_path_corpus() -> PortablePathCorpus {
    serde_json::from_slice(include_bytes!("fixtures/portable-path-corpus.json")).unwrap()
}

#[cfg(windows)]
fn create_directory_symlink(target: &Path, link: &Path) {
    std::os::windows::fs::symlink_dir(target, link).unwrap();
}
