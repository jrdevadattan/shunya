use serde_json::{Value, json};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
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
        assert_eq!(
            response["kind"], "response",
            "{method} returned an RPC error: {response}"
        );
        response["result"].clone()
    }
}

impl Drop for Daemon {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
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
    daemon.rpc("job.start", json!({ "jobId": job_id }));

    let status = daemon.rpc("job.status", json!({ "jobId": job_id }));
    assert_eq!(status["stage"], "completed");
    let limitation_codes = status["limitations"]
        .as_array()
        .unwrap()
        .iter()
        .map(|limitation| limitation["code"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert!(limitation_codes.contains(&"TSK_METADATA_UNAVAILABLE"));
    assert!(limitation_codes.contains(&"PHOTOREC_UNAVAILABLE"));

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
    assert_eq!(artifact["previewStatus"], "safe_preview");

    let loaded = daemon.rpc("artifact.get", json!({ "artifactId": artifact_id }));
    assert_eq!(loaded["sha256"], artifact["sha256"]);
    let preview = daemon.rpc("artifact.preview", json!({ "artifactId": artifact_id }));
    assert_eq!(preview["status"], "safe_preview");
    assert_eq!(preview["kind"], "sanitized_image");

    let exported = daemon.rpc(
        "export.start",
        json!({
            "artifactIds": [artifact_id],
            "destinationPath": export_path,
            "destinationPhysicalId": "integration-destination",
            "acknowledgeUnsafe": false
        }),
    );
    assert_eq!(exported["items"][0]["verified"], true);
    let exported_path = exported["items"][0]["outputPath"].as_str().unwrap();
    assert_eq!(std::fs::read(exported_path).unwrap(), jpeg);

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

    assert_eq!(std::fs::read(&image_path).unwrap(), source_before);
}

fn write_raw_fixture(path: &Path, planted_offset: usize, jpeg: &[u8]) {
    let mut image = vec![0_u8; 2 * 1024 * 1024];
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
