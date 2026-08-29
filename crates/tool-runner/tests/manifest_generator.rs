use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;
use tool_runner::{ProcessStatus, ToolInvocation, ToolRegistry, ToolRunner};

#[tokio::test]
async fn generated_lock_executes_verified_native_fixture_end_to_end() {
    let root = tempdir().unwrap();
    let tools_root = root.path().join("tools");
    let relative_path = PathBuf::from("fixture/tool-runner-fixture");
    let executable = tools_root.join(&relative_path);
    std::fs::create_dir_all(executable.parent().unwrap()).unwrap();
    std::fs::copy(
        PathBuf::from(env!("CARGO_BIN_EXE_tool-runner-fixture")),
        &executable,
    )
    .unwrap();
    let hash: String = Sha256::digest(std::fs::read(&executable).unwrap())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    let candidates = root.path().join("candidates.json");
    let manifest = root.path().join("tools.lock.json");
    let report = root.path().join("capabilities.json");
    std::fs::write(
        &candidates,
        serde_json::to_vec_pretty(&json!({
            "schemaVersion": 1,
            "candidates": [{
                "id": "fixture",
                "version": "1.2.3",
                "license": "Apache-2.0",
                "origin": "https://example.invalid/fixture-release",
                "platform": tool_runner::current_platform(),
                "relativePath": "fixture/tool-runner-fixture",
                "expectedSha256": hash,
                "versionArguments": ["version"],
                "networkAllowed": false,
                "redistributionAllowed": true
            }]
        }))
        .unwrap(),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tool-manifest-generator"))
        .args([
            "--tools-root",
            tools_root.to_str().unwrap(),
            "--candidates",
            candidates.to_str().unwrap(),
            "--manifest",
            manifest.to_str().unwrap(),
            "--report",
            report.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let lock: Value = serde_json::from_slice(&std::fs::read(&manifest).unwrap()).unwrap();
    assert_eq!(lock["tools"][0]["id"], "fixture");
    assert_eq!(lock["tools"][0]["redistributionAllowed"], true);
    let capabilities: Value = serde_json::from_slice(&std::fs::read(report).unwrap()).unwrap();
    assert_eq!(capabilities["capabilities"][0]["status"], "available");

    let registry = ToolRegistry::load(&tools_root, &manifest).unwrap();
    let runner = ToolRunner::new(registry, 4096);
    let outcome = runner
        .execute(
            ToolInvocation {
                tool_id: "fixture".into(),
                args: vec!["echo".into(), "native-e2e".into()],
                working_directory: root.path().join("job"),
                timeout: Duration::from_secs(2),
                environment: Vec::new(),
            },
            CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(outcome.status, ProcessStatus::Exited(Some(0)));
    assert_eq!(outcome.stdout, vec!["native-e2e"]);
}

#[test]
fn generator_fails_closed_but_records_typed_missing_capability() {
    let root = tempdir().unwrap();
    let tools_root = root.path().join("tools");
    std::fs::create_dir_all(&tools_root).unwrap();
    let candidates = root.path().join("candidates.json");
    let manifest = root.path().join("tools.lock.json");
    let report = root.path().join("capabilities.json");
    std::fs::write(
        &candidates,
        serde_json::to_vec_pretty(&json!({
            "schemaVersion": 1,
            "candidates": [{
                "id": "missing",
                "version": "1.0.0",
                "license": "test-only",
                "origin": "test-fixture",
                "platform": tool_runner::current_platform(),
                "relativePath": "missing/tool",
                "expectedSha256": "0000000000000000000000000000000000000000000000000000000000000000",
                "versionArguments": ["--version"],
                "networkAllowed": false,
                "redistributionAllowed": true
            }]
        }))
        .unwrap(),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tool-manifest-generator"))
        .args([
            "--tools-root",
            tools_root.to_str().unwrap(),
            "--candidates",
            candidates.to_str().unwrap(),
            "--manifest",
            manifest.to_str().unwrap(),
            "--report",
            report.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(2));
    let lock: Value = serde_json::from_slice(&std::fs::read(manifest).unwrap()).unwrap();
    assert!(lock["tools"].as_array().unwrap().is_empty());
    let capabilities: Value = serde_json::from_slice(&std::fs::read(report).unwrap()).unwrap();
    assert_eq!(capabilities["capabilities"][0]["status"], "missing");
}

#[test]
fn generator_rejects_duplicate_ids_before_writing_outputs() {
    let root = tempdir().unwrap();
    let tools_root = root.path().join("tools");
    std::fs::create_dir_all(&tools_root).unwrap();
    let candidates = root.path().join("candidates.json");
    let manifest = root.path().join("tools.lock.json");
    let report = root.path().join("capabilities.json");
    let candidate = json!({
        "id": "duplicate",
        "version": "1.0.0",
        "license": "test-only",
        "origin": "test-fixture",
        "platform": tool_runner::current_platform(),
        "relativePath": "missing/tool",
        "expectedSha256": "0000000000000000000000000000000000000000000000000000000000000000",
        "versionArguments": ["--version"],
        "networkAllowed": false,
        "redistributionAllowed": true
    });
    std::fs::write(
        &candidates,
        serde_json::to_vec_pretty(&json!({
            "schemaVersion": 1,
            "candidates": [candidate.clone(), candidate]
        }))
        .unwrap(),
    )
    .unwrap();

    let output = Command::new(env!("CARGO_BIN_EXE_tool-manifest-generator"))
        .args([
            "--tools-root",
            tools_root.to_str().unwrap(),
            "--candidates",
            candidates.to_str().unwrap(),
            "--manifest",
            manifest.to_str().unwrap(),
            "--report",
            report.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    assert_eq!(output.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&output.stderr).contains("duplicate tool ID: duplicate"));
    assert!(!manifest.exists());
    assert!(!report.exists());
}
