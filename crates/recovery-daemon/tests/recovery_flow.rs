use case_store::{CaseInput, CaseStore};
use job_engine::{CheckpointStatus, JobEngine, JobStage};
use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::time::{Duration, Instant};
use tempfile::tempdir;
use uuid::Uuid;

struct Daemon {
    child: Child,
    input: ChildStdin,
    output: BufReader<ChildStdout>,
}

impl Daemon {
    fn start() -> Self {
        let mut child = Command::new(env!("CARGO_BIN_EXE_recoveryd"))
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("daemon starts");
        let input = child.stdin.take().expect("daemon stdin");
        let output = BufReader::new(child.stdout.take().expect("daemon stdout"));
        Self {
            child,
            input,
            output,
        }
    }

    fn rpc(&mut self, method: &str, params: Value) -> Value {
        let response = self.rpc_frame(method, params);
        assert_eq!(
            response["kind"], "response",
            "{method} returned an RPC error: {response}"
        );
        response["result"].clone()
    }

    fn rpc_error(&mut self, method: &str, params: Value) -> Value {
        let response = self.rpc_frame(method, params);
        assert_eq!(
            response["kind"], "error",
            "{method} unexpectedly succeeded: {response}"
        );
        response["error"].clone()
    }

    fn rpc_frame(&mut self, method: &str, params: Value) -> Value {
        let id = Uuid::now_v7();
        serde_json::to_writer(
            &mut self.input,
            &json!({ "id": id, "method": method, "params": params }),
        )
        .expect("request serializes");
        self.input.write_all(b"\n").expect("request newline");
        self.input.flush().expect("request flushes");

        let mut line = String::new();
        self.output.read_line(&mut line).expect("response reads");
        assert!(
            !line.is_empty(),
            "daemon exited without responding to {method}"
        );
        let response: Value = serde_json::from_str(&line).expect("response is JSON");
        assert_eq!(response["id"], id.to_string());
        response
    }

    fn terminate(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl Drop for Daemon {
    fn drop(&mut self) {
        self.terminate();
    }
}

#[test]
fn daemon_runs_read_only_raw_recovery_through_export_and_report() {
    let temporary = tempdir().unwrap();
    let image_path = temporary.path().join("deterministic-fat32.raw");
    let jpeg = [
        b"\xff\xd8\xff\xe0deterministic recovery fixture".as_slice(),
        b"\xff\xd9",
    ]
    .concat();
    let planted_offset = 4096_usize;
    write_raw_fixture(&image_path, planted_offset, &jpeg);
    let source_before = std::fs::read(&image_path).unwrap();

    let case_path = temporary.path().join("case-26149");
    let export_path = temporary.path().join("exports");
    let mut daemon = Daemon::start();

    let recovery_case = daemon.rpc(
        "case.create",
        json!({
            "title": "Deterministic RAW recovery",
            "operator": "Integration Test",
            "referenceNumber": "SIH-26149-T1",
            "organization": "Recovery Platform",
            "workspacePath": case_path,
            "notes": "Task 1 vertical slice"
        }),
    );
    let case_id = recovery_case["caseId"].as_str().unwrap();

    let source = daemon.rpc("source.add_image", json!({ "path": image_path }));
    let source_id = source["sourceId"].as_str().unwrap();
    let assessment = daemon.rpc("source.assess", json!({ "sourceId": source_id }));
    assert_eq!(assessment["decision"], "ready");
    assert_eq!(assessment["findings"][0]["code"], "SOURCE_READY");

    let job = daemon.rpc(
        "job.create",
        json!({
            "caseId": case_id,
            "sourceId": source_id,
            "goal": "recover_everything",
            "preset": "full"
        }),
    );
    let job_id = job["jobId"].as_str().unwrap();
    let started = daemon.rpc("job.start", json!({ "jobId": job_id }));
    assert_eq!(started["stage"], "preflight");

    let status = wait_for_stage(&mut daemon, job_id, "completed");
    assert_eq!(status["stage"], "completed");
    let limitation_codes = status["limitations"]
        .as_array()
        .unwrap()
        .iter()
        .map(|limitation| limitation["code"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert!(limitation_codes.contains(&"TSK_METADATA_UNAVAILABLE"));
    assert!(limitation_codes.contains(&"PHOTOREC_UNAVAILABLE"));
    assert!(limitation_codes.contains(&"YARA_X_UNAVAILABLE"));
    assert_eq!(status["partitions"]["sectorSize"], 512);
    assert_eq!(
        status["partitions"]["partitions"][0]["partitionId"],
        "partition-1"
    );
    assert_eq!(status["partitions"]["partitions"][0]["startSector"], "1");
    assert_eq!(status["partitions"]["partitions"][0]["sectorCount"], "4095");
    assert_eq!(
        status["partitions"]["partitions"][0]["startOffsetBytes"],
        "512"
    );
    assert_eq!(
        status["partitions"]["partitions"][0]["lengthBytes"],
        "2096640"
    );
    assert_eq!(
        status["partitions"]["partitions"][0]["partitionType"],
        "FAT32"
    );

    let events = daemon.rpc("job.events", json!({ "jobId": job_id, "afterSequence": 0 }));
    let stages = events
        .as_array()
        .unwrap()
        .iter()
        .map(|event| event["stage"].as_str().unwrap())
        .collect::<Vec<_>>();
    for expected in [
        "preflight",
        "partition_scan",
        "metadata_scan",
        "carving",
        "validating",
        "indexing",
        "completed",
    ] {
        assert!(
            stages.contains(&expected),
            "missing {expected} in {stages:?}"
        );
    }

    let page = daemon.rpc("artifact.query", json!({ "pageSize": 25 }));
    let artifacts = page["items"].as_array().unwrap();
    assert_eq!(artifacts.len(), 1);
    let artifact = &artifacts[0];
    let artifact_id = artifact["artifactId"].as_str().unwrap();
    assert_eq!(artifact["recoveryMethod"], "carving");
    assert_eq!(artifact["recoveryState"], "complete_validated");
    assert!(artifact["originalName"].is_null());
    assert!(artifact["originalPath"].is_null());
    assert_eq!(
        artifact["sourceRanges"][0]["offset"],
        planted_offset.to_string()
    );
    assert_eq!(
        artifact["sourceRanges"][0]["length"],
        jpeg.len().to_string()
    );
    assert_eq!(artifact["threatStatus"], "not_scanned");
    assert_eq!(artifact["previewStatus"], "unsupported");
    let visible_name_search = daemon.rpc(
        "artifact.query",
        json!({ "search": artifact["displayName"], "pageSize": 25 }),
    );
    assert_eq!(visible_name_search["items"].as_array().unwrap().len(), 1);
    assert_eq!(
        visible_name_search["items"][0]["artifactId"],
        artifact["artifactId"]
    );
    assert!(visible_name_search["items"][0]["originalName"].is_null());

    let loaded = daemon.rpc("artifact.get", json!({ "artifactId": artifact_id }));
    assert_eq!(loaded["sha256"], artifact["sha256"]);
    let preview = daemon.rpc("artifact.preview", json!({ "artifactId": artifact_id }));
    assert_eq!(preview["status"], "unsupported");
    assert_eq!(preview["policy"], "derivative_required");
    assert!(preview.get("activeContent").is_none());

    let export_error = daemon.rpc_error(
        "export.start",
        json!({
            "artifactIds": [artifact_id],
            "destinationPath": export_path,
            "destinationPhysicalId": "integration-destination",
            "acknowledgeUnsafe": false
        }),
    );
    assert_eq!(export_error["code"], "EXPORT_DESTINATION_NOT_SEPARATE");

    let report = daemon.rpc("report.generate", json!({ "caseId": case_id }));
    let report_json = report["jsonPath"].as_str().unwrap();
    let report_markdown = report["markdownPath"].as_str().unwrap();
    assert!(Path::new(report_json).is_file());
    assert!(Path::new(report_markdown).is_file());
    let report_manifest: Value =
        serde_json::from_slice(&std::fs::read(report_json).unwrap()).unwrap();
    assert_eq!(report_manifest["caseId"], case_id);
    assert!(
        report_manifest["limitations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|value| value.as_str().unwrap().contains("TSK_METADATA_UNAVAILABLE"))
    );
    assert!(
        report_manifest["limitations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|value| value.as_str().unwrap().contains("YARA_X_UNAVAILABLE"))
    );
    assert!(
        !report_manifest["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|tool| tool["id"].as_str().unwrap().contains("yara"))
    );

    let artifacts_path = case_path.join("work").join(job_id).join("artifacts.json");
    let mut stored: Vec<Value> =
        serde_json::from_slice(&std::fs::read(&artifacts_path).unwrap()).unwrap();
    stored.push(json!({
        "artifactId": "active-fixture",
        "sourceId": source_id,
        "partitionId": null,
        "originalName": "script.exe",
        "originalPath": "/Downloads/script.exe",
        "displayName": "script.exe",
        "extension": "exe",
        "mimeType": "application/x-msdownload",
        "sizeBytes": "4",
        "recoveryMethod": "metadata",
        "recoveryState": "complete_unverified",
        "sha256": null,
        "sourceRanges": [],
        "threatStatus": "not_scanned",
        "previewStatus": "safe_preview"
    }));
    std::fs::write(&artifacts_path, serde_json::to_vec_pretty(&stored).unwrap()).unwrap();
    let blocked = daemon.rpc(
        "artifact.preview",
        json!({ "artifactId": "active-fixture" }),
    );
    assert_eq!(blocked["status"], "blocked");
    assert_eq!(blocked["policy"], "active_or_unsupported_content");
    assert!(blocked.get("activeContent").is_none());

    assert_eq!(std::fs::read(&image_path).unwrap(), source_before);
}

#[test]
fn running_job_can_be_observed_paused_resumed_and_cancelled() {
    let temporary = tempdir().unwrap();
    let (mut daemon, _, _, _, job_id, _) = setup_job(temporary.path(), 64 * 1024 * 1024);

    let started = daemon.rpc("job.start", json!({ "jobId": job_id }));
    assert_eq!(started["stage"], "preflight");
    let observed = daemon.rpc("job.status", json!({ "jobId": job_id }));
    assert_ne!(observed["stage"], "completed");

    let paused = daemon.rpc("job.pause", json!({ "jobId": job_id }));
    assert_eq!(paused["stage"], "paused");
    assert_eq!(
        daemon.rpc("job.status", json!({ "jobId": job_id }))["stage"],
        "paused"
    );

    let resumed = daemon.rpc("job.resume", json!({ "jobId": job_id }));
    assert_ne!(resumed["stage"], "paused");
    let cancelled = daemon.rpc("job.cancel", json!({ "jobId": job_id }));
    assert_eq!(cancelled["stage"], "cancelled");
    assert_eq!(
        wait_for_stage(&mut daemon, &job_id, "cancelled")["stage"],
        "cancelled"
    );
}

#[test]
fn interrupted_job_is_recovered_paused_and_resume_completes_it() {
    let temporary = tempdir().unwrap();
    let (mut daemon, case_path, _, _, job_id, _) = setup_job(temporary.path(), 64 * 1024 * 1024);

    let started = daemon.rpc("job.start", json!({ "jobId": job_id }));
    assert_eq!(started["stage"], "preflight");
    daemon.terminate();

    let mut restarted = Daemon::start();
    restarted.rpc("case.open", json!({ "casePath": case_path }));
    let recovered = restarted.rpc("job.status", json!({ "jobId": job_id }));
    assert_eq!(recovered["stage"], "paused");
    restarted.rpc("job.resume", json!({ "jobId": job_id }));
    assert_eq!(
        wait_for_stage(&mut restarted, &job_id, "completed")["stage"],
        "completed"
    );
}

#[test]
fn completed_stage_handoff_gap_is_recovered_after_restart() {
    let temporary = tempdir().unwrap();
    let (mut daemon, case_path, _, _, job_id, _) = setup_job(temporary.path(), 2 * 1024 * 1024);
    daemon.terminate();

    let parsed_job_id = Uuid::parse_str(&job_id).unwrap();
    let mut engine = JobEngine::open(&case_path).unwrap();
    engine.start(parsed_job_id).unwrap();
    engine
        .checkpoint(
            parsed_job_id,
            JobStage::Preflight,
            CheckpointStatus::Completed,
            2 * 1024 * 1024,
            json!({ "phase": "completed_before_next_stage_handoff" }),
        )
        .unwrap();
    drop(engine);

    let mut restarted = Daemon::start();
    restarted.rpc("case.open", json!({ "casePath": case_path }));
    let recovered = restarted.rpc("job.status", json!({ "jobId": job_id }));
    assert_eq!(recovered["stage"], "paused");
    restarted.rpc("job.resume", json!({ "jobId": job_id }));
    assert_eq!(
        wait_for_stage(&mut restarted, &job_id, "completed")["stage"],
        "completed"
    );
}

#[test]
fn case_switch_is_refused_while_worker_runs_and_cancel_stays_controlled() {
    let temporary = tempdir().unwrap();
    let (mut daemon, case_path, _, _, job_id, _) = setup_job(temporary.path(), 128 * 1024 * 1024);
    let secondary_path = temporary.path().join("secondary-case");
    CaseStore::create(
        &secondary_path,
        CaseInput {
            title: "Secondary case".into(),
            operator: "Integration Test".into(),
            reference_number: None,
            organization: None,
            notes: None,
        },
    )
    .unwrap();

    daemon.rpc("job.start", json!({ "jobId": job_id }));
    let open_error = daemon.rpc_error("case.open", json!({ "casePath": secondary_path }));
    assert_eq!(open_error["code"], "CASE_BUSY");
    let create_error = daemon.rpc_error(
        "case.create",
        json!({
            "title": "Must not replace active state",
            "operator": "Integration Test",
            "workspacePath": temporary.path().join("third-case")
        }),
    );
    assert_eq!(create_error["code"], "CASE_BUSY");

    assert_ne!(
        daemon.rpc("job.status", json!({ "jobId": job_id }))["stage"],
        "completed"
    );
    assert_eq!(
        daemon.rpc("job.cancel", json!({ "jobId": job_id }))["stage"],
        "cancelled"
    );
    let events = daemon.rpc("job.events", json!({ "jobId": job_id }));
    assert_eq!(
        events
            .as_array()
            .unwrap()
            .iter()
            .filter(|event| event["stage"] == "cancelled")
            .count(),
        1
    );

    daemon.rpc("case.open", json!({ "casePath": secondary_path }));
    assert_eq!(
        JobEngine::open(&case_path)
            .unwrap()
            .snapshot(Uuid::parse_str(&job_id).unwrap())
            .unwrap()
            .stage,
        JobStage::Cancelled
    );
}

#[test]
fn missing_source_during_resume_is_persisted_as_needs_attention() {
    let temporary = tempdir().unwrap();
    let (mut daemon, _, _, _, job_id, image_path) = setup_job(temporary.path(), 64 * 1024 * 1024);

    daemon.rpc("job.start", json!({ "jobId": job_id }));
    daemon.rpc("job.pause", json!({ "jobId": job_id }));
    std::fs::remove_file(image_path).unwrap();
    daemon.rpc("job.resume", json!({ "jobId": job_id }));
    let status = wait_for_stage(&mut daemon, &job_id, "needs_attention");
    assert_eq!(status["stage"], "needs_attention");
    let events = daemon.rpc("job.events", json!({ "jobId": job_id }));
    assert!(
        events
            .as_array()
            .unwrap()
            .iter()
            .any(|event| event["stage"] == "needs_attention")
    );
}

#[test]
fn needs_attention_failure_survives_restart_and_resumes_after_remediation() {
    let temporary = tempdir().unwrap();
    let (mut daemon, case_path, _, _, job_id, image_path) =
        setup_job(temporary.path(), 2 * 1024 * 1024);
    let disconnected_path = temporary.path().join("temporarily-disconnected.raw");
    std::fs::rename(&image_path, &disconnected_path).unwrap();

    daemon.rpc("job.start", json!({ "jobId": job_id }));
    assert_eq!(
        wait_for_stage(&mut daemon, &job_id, "needs_attention")["stage"],
        "needs_attention"
    );
    daemon.terminate();

    std::fs::rename(&disconnected_path, &image_path).unwrap();
    let mut restarted = Daemon::start();
    restarted.rpc("case.open", json!({ "casePath": case_path }));
    assert_eq!(
        restarted.rpc("job.status", json!({ "jobId": job_id }))["stage"],
        "needs_attention"
    );
    restarted.rpc("job.resume", json!({ "jobId": job_id }));
    assert_eq!(
        wait_for_stage(&mut restarted, &job_id, "completed")["stage"],
        "completed"
    );
}

#[test]
fn unverified_threat_and_preview_capabilities_are_never_claimed() {
    let temporary = tempdir().unwrap();
    let (mut daemon, case_path, case_id, _, job_id, _) =
        setup_job(temporary.path(), 2 * 1024 * 1024);
    daemon.rpc("job.start", json!({ "jobId": job_id }));
    let status = wait_for_stage(&mut daemon, &job_id, "completed");
    assert!(
        status["limitations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item["code"] == "YARA_X_UNAVAILABLE")
    );

    let artifact = daemon.rpc("artifact.query", json!({ "pageSize": 1 }))["items"][0].clone();
    assert_eq!(artifact["threatStatus"], "not_scanned");
    assert_eq!(artifact["previewStatus"], "unsupported");
    let preview = daemon.rpc(
        "artifact.preview",
        json!({ "artifactId": artifact["artifactId"] }),
    );
    assert_eq!(preview["status"], "unsupported");
    assert_eq!(preview["policy"], "derivative_required");
    assert!(preview.get("activeContent").is_none());

    let artifacts_path = case_path.join("work").join(&job_id).join("artifacts.json");
    let mut stored: Vec<Value> =
        serde_json::from_slice(&std::fs::read(&artifacts_path).unwrap()).unwrap();
    stored.push(active_artifact_fixture(&status["sourceId"]));
    std::fs::write(&artifacts_path, serde_json::to_vec_pretty(&stored).unwrap()).unwrap();
    let blocked = daemon.rpc(
        "artifact.preview",
        json!({ "artifactId": "active-fixture" }),
    );
    assert_eq!(blocked["status"], "blocked");
    assert_eq!(blocked["policy"], "active_or_unsupported_content");
    assert!(blocked.get("activeContent").is_none());

    let report = daemon.rpc("report.generate", json!({ "caseId": case_id }));
    let manifest: Value =
        serde_json::from_slice(&std::fs::read(report["jsonPath"].as_str().unwrap()).unwrap())
            .unwrap();
    assert!(
        manifest["limitations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|item| item.as_str().unwrap().contains("YARA_X_UNAVAILABLE"))
    );
    assert!(
        !manifest["tools"]
            .as_array()
            .unwrap()
            .iter()
            .any(|tool| tool["id"].as_str().unwrap().contains("yara"))
    );
}

#[test]
fn renderer_cannot_bypass_same_device_export_check() {
    let temporary = tempdir().unwrap();
    let (mut daemon, _, _, _, job_id, _) = setup_job(temporary.path(), 2 * 1024 * 1024);
    daemon.rpc("job.start", json!({ "jobId": job_id }));
    wait_for_stage(&mut daemon, &job_id, "completed");
    let artifact_id =
        daemon.rpc("artifact.query", json!({ "pageSize": 1 }))["items"][0]["artifactId"]
            .as_str()
            .unwrap()
            .to_owned();
    let error = daemon.rpc_error(
        "export.start",
        json!({
            "artifactIds": [artifact_id],
            "destinationPath": temporary.path().join("same-volume-export"),
            "destinationPhysicalId": "renderer-lies-about-separation",
            "acknowledgeUnsafe": false
        }),
    );
    assert_eq!(error["code"], "EXPORT_DESTINATION_NOT_SEPARATE");
}

#[test]
fn preview_requires_evidenced_derivative_and_blocks_active_formats() {
    let temporary = tempdir().unwrap();
    let (mut daemon, case_path, _, _, job_id, _) = setup_job(temporary.path(), 2 * 1024 * 1024);
    daemon.rpc("job.start", json!({ "jobId": job_id }));
    let status = wait_for_stage(&mut daemon, &job_id, "completed");
    let artifact = daemon.rpc("artifact.query", json!({ "pageSize": 1 }))["items"][0].clone();
    let preview = daemon.rpc(
        "artifact.preview",
        json!({ "artifactId": artifact["artifactId"] }),
    );
    assert_eq!(preview["status"], "unsupported");
    assert_eq!(preview["policy"], "derivative_required");
    assert!(preview.get("activeContent").is_none());

    let artifacts_path = case_path.join("work").join(&job_id).join("artifacts.json");
    let mut stored: Vec<Value> =
        serde_json::from_slice(&std::fs::read(&artifacts_path).unwrap()).unwrap();
    stored.push(active_artifact_fixture(&status["sourceId"]));
    stored.push(unknown_artifact_fixture(&status["sourceId"]));
    std::fs::write(&artifacts_path, serde_json::to_vec_pretty(&stored).unwrap()).unwrap();
    let blocked = daemon.rpc(
        "artifact.preview",
        json!({ "artifactId": "active-fixture" }),
    );
    assert_eq!(blocked["status"], "blocked");
    assert_eq!(blocked["policy"], "active_or_unsupported_content");
    assert!(blocked.get("activeContent").is_none());

    let unsupported = daemon.rpc(
        "artifact.preview",
        json!({ "artifactId": "unknown-fixture" }),
    );
    assert_eq!(unsupported["status"], "blocked");
    assert_eq!(unsupported["policy"], "active_or_unsupported_content");
    assert!(unsupported.get("activeContent").is_none());
}

fn setup_job(
    root: &Path,
    image_size: usize,
) -> (
    Daemon,
    std::path::PathBuf,
    String,
    String,
    String,
    std::path::PathBuf,
) {
    let image_path = root.join("controlled.raw");
    let jpeg = [b"\xff\xd8\xff\xe0controlled".as_slice(), b"\xff\xd9"].concat();
    write_raw_fixture_sized(&image_path, 4096, &jpeg, image_size);
    let case_path = root.join("controlled-case");
    let mut daemon = Daemon::start();
    let case = daemon.rpc(
        "case.create",
        json!({
            "title": "Controlled recovery job",
            "operator": "Integration Test",
            "workspacePath": case_path
        }),
    );
    let source = daemon.rpc("source.add_image", json!({ "path": image_path }));
    let job = daemon.rpc(
        "job.create",
        json!({
            "caseId": case["caseId"],
            "sourceId": source["sourceId"],
            "goal": "recover_everything",
            "preset": "full"
        }),
    );
    (
        daemon,
        case_path,
        case["caseId"].as_str().unwrap().to_owned(),
        source["sourceId"].as_str().unwrap().to_owned(),
        job["jobId"].as_str().unwrap().to_owned(),
        image_path,
    )
}

fn wait_for_stage(daemon: &mut Daemon, job_id: &str, expected: &str) -> Value {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let status = daemon.rpc("job.status", json!({ "jobId": job_id }));
        if status["stage"] == expected {
            return status;
        }
        assert!(
            Instant::now() < deadline,
            "timed out waiting for {expected}; last status was {status}"
        );
        std::thread::sleep(Duration::from_millis(10));
    }
}

fn active_artifact_fixture(source_id: &Value) -> Value {
    json!({
        "artifactId": "active-fixture",
        "sourceId": source_id,
        "partitionId": null,
        "originalName": "script.exe",
        "originalPath": "/Downloads/script.exe",
        "displayName": "script.exe",
        "extension": "exe",
        "mimeType": "application/x-msdownload",
        "sizeBytes": "4",
        "recoveryMethod": "metadata",
        "recoveryState": "complete_unverified",
        "sha256": null,
        "sourceRanges": [],
        "threatStatus": "not_scanned",
        "previewStatus": "safe_preview"
    })
}

fn unknown_artifact_fixture(source_id: &Value) -> Value {
    json!({
        "artifactId": "unknown-fixture",
        "sourceId": source_id,
        "partitionId": null,
        "originalName": "unknown.bin",
        "originalPath": "/unknown.bin",
        "displayName": "unknown.bin",
        "extension": "bin",
        "mimeType": "application/octet-stream",
        "sizeBytes": "4",
        "recoveryMethod": "metadata",
        "recoveryState": "complete_unverified",
        "sha256": null,
        "sourceRanges": [],
        "threatStatus": "not_scanned",
        "previewStatus": "safe_preview"
    })
}

fn write_raw_fixture(path: &Path, planted_offset: usize, jpeg: &[u8]) {
    write_raw_fixture_sized(path, planted_offset, jpeg, 2 * 1024 * 1024);
}

fn write_raw_fixture_sized(path: &Path, planted_offset: usize, jpeg: &[u8], size: usize) {
    let mut image = vec![0_u8; size];
    image[510] = 0x55;
    image[511] = 0xaa;
    image[446 + 4] = 0x0c;
    image[446 + 8..446 + 12].copy_from_slice(&1_u32.to_le_bytes());
    let partition_sectors = (image.len() / 512 - 1) as u32;
    image[446 + 12..446 + 16].copy_from_slice(&partition_sectors.to_le_bytes());
    image[512 + 82..512 + 90].copy_from_slice(b"FAT32   ");
    image[planted_offset..planted_offset + jpeg.len()].copy_from_slice(jpeg);
    std::fs::write(path, image).unwrap();
}
