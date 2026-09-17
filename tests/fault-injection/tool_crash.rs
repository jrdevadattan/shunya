use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::Duration;
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;
use tool_runner::{
    ProcessStatus, ToolInvocation, ToolManifest, ToolManifestEntry, ToolRegistry, ToolRunner,
    current_platform,
};

#[tokio::test]
async fn tool_crash_and_malformed_output_are_contained_and_logged() {
    let executable = PathBuf::from(env!("CARGO_BIN_EXE_fault-tool"));
    let root = tempdir().unwrap();
    let bytes = std::fs::read(&executable).unwrap();
    let hash: String = Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let registry = ToolRegistry::from_manifest(
        executable.parent().unwrap(),
        ToolManifest {
            manifest_version: 1,
            tools: vec![ToolManifestEntry {
                id: "fault-tool".into(),
                version: "1".into(),
                license: "test-only".into(),
                origin: "test-fixture".into(),
                platform: current_platform().into(),
                relative_path: PathBuf::from(executable.file_name().unwrap()),
                sha256: hash,
                network_allowed: false,
                redistribution_allowed: true,
            }],
        },
    )
    .unwrap();
    let runner = ToolRunner::new(registry, 4096);
    let invocation = |argument: &str| ToolInvocation {
        tool_id: "fault-tool".into(),
        args: vec![argument.into()],
        working_directory: root.path().join(argument),
        timeout: Duration::from_secs(5),
        environment: Vec::new(),
    };
    let crashed = runner
        .execute(invocation("crash"), CancellationToken::new())
        .await
        .unwrap();
    assert!(matches!(crashed.status, ProcessStatus::Exited(Some(23))));
    let malformed = runner
        .execute(invocation("malformed"), CancellationToken::new())
        .await
        .unwrap();
    assert!(malformed.stdout[0].contains("not valid json"));
}
