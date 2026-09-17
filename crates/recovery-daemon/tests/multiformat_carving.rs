//! Multi-format signature carving: the built-in engine, operator family
//! filters, and the verified PhotoRec adapter (exercised with a stand-in tool
//! that mimics PhotoRec's output layout, since the real binary is not vendored).

use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
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
    fn start(environment: &[(&str, &Path)]) -> Self {
        let executable = std::env::var_os("RECOVERY_DAEMON_UNDER_TEST")
            .unwrap_or_else(|| env!("CARGO_BIN_EXE_recoveryd").into());
        let mut command = Command::new(executable);
        for (key, value) in environment {
            command.env(key, value);
        }
        let mut child = command
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
            &json!({ "kind": "request", "id": id, "method": method, "params": params }),
        )
        .unwrap();
        self.input.write_all(b"\n").unwrap();
        self.input.flush().unwrap();
        loop {
            let mut line = String::new();
            assert!(
                self.output.read_line(&mut line).unwrap() > 0,
                "daemon closed its output before answering {method}"
            );
            let frame: Value = serde_json::from_str(line.trim()).unwrap();
            if frame["id"] == json!(id) {
                return frame;
            }
        }
    }
}

impl Drop for Daemon {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn wait_for_completion(daemon: &mut Daemon, job_id: &str) -> Value {
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        let status = daemon.rpc("job.status", json!({ "jobId": job_id }));
        if status["stage"] == "completed" {
            return status;
        }
        assert!(
            !matches!(
                status["stage"].as_str(),
                Some("failed" | "needs_attention" | "cancelled")
            ) && Instant::now() < deadline,
            "job did not complete; last status was {status}"
        );
        std::thread::sleep(Duration::from_millis(50));
    }
}

fn limitation_codes(status: &Value) -> Vec<String> {
    status["limitations"]
        .as_array()
        .unwrap()
        .iter()
        .map(|limitation| limitation["code"].as_str().unwrap().to_owned())
        .collect()
}

// ---------------------------------------------------------------------------
// Fixtures: minimal but structurally valid files of each family.
// ---------------------------------------------------------------------------

fn jpeg() -> Vec<u8> {
    [b"\xff\xd8\xff\xe0\x00\x10JFIF\0\x01\x01\0\0\x01\0\x01\0\0".as_slice(), b"\xff\xda\x00\x02", b"\x12\x34\xff\x00\x56", b"\xff\xd9"].concat()
}

fn png() -> Vec<u8> {
    let mut png = b"\x89PNG\r\n\x1a\n".to_vec();
    png.extend_from_slice(&13u32.to_be_bytes());
    png.extend_from_slice(b"IHDR");
    png.extend_from_slice(&[0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
    png.extend_from_slice(&[0; 4]);
    png.extend_from_slice(&0u32.to_be_bytes());
    png.extend_from_slice(b"IEND");
    png.extend_from_slice(&[0xae, 0x42, 0x60, 0x82]);
    png
}

fn pdf() -> Vec<u8> {
    b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n".to_vec()
}

fn docx() -> Vec<u8> {
    let name = b"word/document.xml";
    let body = b"<w:document/>";
    let mut zip = b"PK\x03\x04".to_vec();
    zip.extend_from_slice(&[0; 14]);
    zip.extend_from_slice(&(body.len() as u32).to_le_bytes());
    zip.extend_from_slice(&(body.len() as u32).to_le_bytes());
    zip.extend_from_slice(&(name.len() as u16).to_le_bytes());
    zip.extend_from_slice(&0u16.to_le_bytes());
    zip.extend_from_slice(name);
    zip.extend_from_slice(body);
    let central_offset = zip.len() as u32;
    zip.extend_from_slice(b"PK\x01\x02");
    zip.extend_from_slice(&[0; 42]);
    let central_size = zip.len() as u32 - central_offset;
    zip.extend_from_slice(b"PK\x05\x06");
    zip.extend_from_slice(&[0; 8]);
    zip.extend_from_slice(&central_size.to_le_bytes());
    zip.extend_from_slice(&central_offset.to_le_bytes());
    zip.extend_from_slice(&0u16.to_le_bytes());
    zip
}

fn sqlite() -> Vec<u8> {
    let mut database = vec![0u8; 1024];
    database[..16].copy_from_slice(b"SQLite format 3\0");
    database[16..18].copy_from_slice(&512u16.to_be_bytes());
    database[28..32].copy_from_slice(&2u32.to_be_bytes());
    database
}

fn mp4() -> Vec<u8> {
    let mut mp4 = Vec::new();
    mp4.extend_from_slice(&16u32.to_be_bytes());
    mp4.extend_from_slice(b"ftypisom");
    mp4.extend_from_slice(&[0; 4]);
    mp4.extend_from_slice(&24u32.to_be_bytes());
    mp4.extend_from_slice(b"moov");
    mp4.extend_from_slice(&[0; 16]);
    mp4.extend_from_slice(&28u32.to_be_bytes());
    mp4.extend_from_slice(b"mdat");
    mp4.extend_from_slice(&[7; 20]);
    mp4
}

fn gif() -> Vec<u8> {
    let mut gif = b"GIF89a".to_vec();
    gif.extend_from_slice(&[1, 0, 1, 0, 0x00, 0, 0]);
    gif.extend_from_slice(&[0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00]);
    gif.push(0x3b);
    gif
}

fn wav() -> Vec<u8> {
    let payload = [0u8; 32];
    let mut wav = b"RIFF".to_vec();
    wav.extend_from_slice(&((4 + payload.len()) as u32).to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    wav.extend_from_slice(&payload);
    wav
}

fn build_image(size: usize, planted: &[(usize, Vec<u8>)]) -> Vec<u8> {
    let mut image = vec![0_u8; size];
    image[510] = 0x55;
    image[511] = 0xaa;
    image[446 + 4] = 0x0c;
    image[446 + 8..446 + 12].copy_from_slice(&1_u32.to_le_bytes());
    let partition_sectors = (image.len() / 512 - 1) as u32;
    image[446 + 12..446 + 16].copy_from_slice(&partition_sectors.to_le_bytes());
    image[512 + 82..512 + 90].copy_from_slice(b"FAT32   ");
    for (offset, bytes) in planted {
        image[*offset..*offset + bytes.len()].copy_from_slice(bytes);
    }
    image
}

fn create_case_and_source(daemon: &mut Daemon, root: &Path, image: &Path) -> (String, String) {
    let case = daemon.rpc(
        "case.create",
        json!({
            "title": "Multi-format carving",
            "operator": "Integration Test",
            "workspacePath": root.join("case")
        }),
    );
    let source = daemon.rpc("source.add_image", json!({ "path": image }));
    (
        case["caseId"].as_str().unwrap().to_owned(),
        source["sourceId"].as_str().unwrap().to_owned(),
    )
}

fn run_job(daemon: &mut Daemon, case_id: &str, source_id: &str, families: Option<Value>) -> (String, Value) {
    let mut params = json!({
        "caseId": case_id,
        "sourceId": source_id,
        "goal": "recover_everything",
        "preset": "full"
    });
    if let Some(families) = families {
        params["families"] = families;
    }
    let job = daemon.rpc("job.create", params);
    let job_id = job["jobId"].as_str().unwrap().to_owned();
    daemon.rpc("job.start", json!({ "jobId": job_id }));
    let status = wait_for_completion(daemon, &job_id);
    (job_id, status)
}

fn mime_types(page: &Value) -> Vec<String> {
    let mut types: Vec<String> = page["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|artifact| artifact["mimeType"].as_str().unwrap_or("null").to_owned())
        .collect();
    types.sort();
    types
}

#[test]
fn built_in_engine_carves_every_family_and_honours_the_family_filter() {
    let temporary = tempdir().unwrap();
    let planted = vec![
        (4096, jpeg()),
        (64 * 1024, png()),
        (128 * 1024, pdf()),
        (192 * 1024, docx()),
        (256 * 1024, sqlite()),
        (320 * 1024, mp4()),
        (384 * 1024, gif()),
        (448 * 1024, wav()),
    ];
    let image_path = temporary.path().join("multi.raw");
    std::fs::write(&image_path, build_image(2 * 1024 * 1024, &planted)).unwrap();

    let mut daemon = Daemon::start(&[]);
    let (case_id, source_id) = create_case_and_source(&mut daemon, temporary.path(), &image_path);

    // Every family by default.
    let (_, status) = run_job(&mut daemon, &case_id, &source_id, None);
    assert_eq!(status["families"].as_array().unwrap().len(), 6);
    let codes = limitation_codes(&status);
    assert!(codes.contains(&"PHOTOREC_UNAVAILABLE".to_owned()));
    let photorec = status["limitations"]
        .as_array()
        .unwrap()
        .iter()
        .find(|limitation| limitation["code"] == "PHOTOREC_UNAVAILABLE")
        .unwrap();
    assert!(photorec["explanation"].as_str().unwrap().contains("multi-format"));

    let page = daemon.rpc("artifact.query", json!({ "pageSize": 50 }));
    assert_eq!(page["totalCount"], json!(8));
    assert_eq!(
        mime_types(&page),
        vec![
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/x-sqlite3",
            "audio/wav",
            "image/gif",
            "image/jpeg",
            "image/png",
            "video/mp4",
        ]
    );
    for artifact in page["items"].as_array().unwrap() {
        assert_eq!(artifact["recoveryMethod"], "carving");
        assert_ne!(artifact["recoveryState"], "corrupt", "{artifact}");
        assert!(artifact["originalPath"].is_null());
        let offset: usize = artifact["sourceRanges"][0]["offset"].as_str().unwrap().parse().unwrap();
        let length: usize = artifact["sourceRanges"][0]["length"].as_str().unwrap().parse().unwrap();
        let expected = planted.iter().find(|(planted_offset, _)| *planted_offset == offset).unwrap();
        assert_eq!(length, expected.1.len(), "{artifact}");
    }
    let names: Vec<&str> = page["items"].as_array().unwrap().iter().map(|artifact| artifact["displayName"].as_str().unwrap()).collect();
    assert!(names.iter().any(|name| name.starts_with("Recovered DOCX")), "{names:?}");
    assert!(names.iter().any(|name| name.starts_with("Recovered MP4")), "{names:?}");

    // Family filters are evaluated server-side on the detected MIME type.
    let images = daemon.rpc("artifact.query", json!({ "family": "images", "pageSize": 50 }));
    assert_eq!(images["totalCount"], json!(3));
    let documents = daemon.rpc("artifact.query", json!({ "family": "documents", "pageSize": 50 }));
    assert_eq!(documents["totalCount"], json!(2));
    let other = daemon.rpc("artifact.query", json!({ "family": "other", "pageSize": 50 }));
    assert_eq!(other["totalCount"], json!(0));
    let bad = daemon.rpc_error("artifact.query", json!({ "family": "spreadsheets", "pageSize": 50 }));
    assert_eq!(bad["code"], "INVALID_ARTIFACT_QUERY");

    // A narrowed selection only carves the requested families.
    let (_, status) = run_job(&mut daemon, &case_id, &source_id, Some(json!(["documents", "databases"])));
    assert_eq!(status["families"], json!(["documents", "databases"]));
    let page = daemon.rpc("artifact.query", json!({ "pageSize": 50 }));
    assert_eq!(
        mime_types(&page),
        vec![
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/x-sqlite3",
        ]
    );

    // An empty selection is refused before any job is created.
    let refused = daemon.rpc_error(
        "job.create",
        json!({ "caseId": case_id, "sourceId": source_id, "goal": "recover_everything", "preset": "full", "families": [] }),
    );
    assert_eq!(refused["code"], "INVALID_JOB_INPUT");

    // The generated report names the built-in engine as the carving tool.
    let report = daemon.rpc("report.generate", json!({ "caseId": case_id }));
    let report_json = std::fs::read_to_string(report["jsonPath"].as_str().unwrap()).unwrap();
    assert!(report_json.contains("signature-carver-built-in"));
}

// ---------------------------------------------------------------------------
// PhotoRec adapter, driven by a stand-in that reproduces PhotoRec's
// `recup.N/` output layout and DFXML report.
// ---------------------------------------------------------------------------

struct FakePhotoRec {
    root: PathBuf,
}

impl FakePhotoRec {
    /// `behaviour` is `"succeed"` (copy the stash into `<recup>.1`) or `"fail"`.
    fn install(root: &Path, behaviour: &str) -> Self {
        std::fs::create_dir_all(root.join("stash")).unwrap();
        #[cfg(windows)]
        let (name, script) = (
            "photorec.cmd",
            match behaviour {
                "succeed" => "@echo off\r\nmkdir \"%~2.1\"\r\ncopy /b \"%~dp0stash\\*\" \"%~2.1\\\" >nul\r\nexit /b 0\r\n".to_owned(),
                _ => "@echo off\r\necho photorec: simulated failure 1>&2\r\nexit /b 3\r\n".to_owned(),
            },
        );
        #[cfg(not(windows))]
        let (name, script) = (
            "photorec",
            match behaviour {
                "succeed" => "#!/bin/sh\nmkdir -p \"$2.1\"\ncp \"$(dirname \"$0\")/stash/\"* \"$2.1/\"\nexit 0\n".to_owned(),
                _ => "#!/bin/sh\necho 'photorec: simulated failure' >&2\nexit 3\n".to_owned(),
            },
        );
        let executable = root.join(name);
        std::fs::write(&executable, script.as_bytes()).unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        let digest: String = Sha256::digest(std::fs::read(&executable).unwrap())
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        let platform = match (std::env::consts::OS, std::env::consts::ARCH) {
            ("windows", "x86_64") => "windows-x64",
            ("linux", "x86_64") => "linux-x64",
            ("linux", "aarch64") => "linux-arm64",
            ("macos", "x86_64") => "macos-x64",
            ("macos", "aarch64") => "macos-arm64",
            _ => "unsupported",
        };
        std::fs::write(
            root.join("tools.lock.json"),
            serde_json::to_string_pretty(&json!({
                "manifestVersion": 1,
                "tools": [{
                    "id": "photorec",
                    "version": "7.2-test",
                    "license": "GPL-2.0-or-later",
                    "origin": "https://www.cgsecurity.org/wiki/TestDisk_Download",
                    "platform": platform,
                    "relativePath": name,
                    "sha256": digest,
                    "networkAllowed": false,
                    "redistributionAllowed": true
                }]
            }))
            .unwrap(),
        )
        .unwrap();
        Self { root: root.to_path_buf() }
    }

    fn stash(&self, name: &str, bytes: &[u8]) {
        std::fs::write(self.root.join("stash").join(name), bytes).unwrap();
    }
}

#[test]
fn verified_photorec_adapter_runs_and_records_reported_byte_runs() {
    let temporary = tempdir().unwrap();
    let tools = FakePhotoRec::install(&temporary.path().join("tools"), "succeed");
    tools.stash("f0000001.png", &png());
    tools.stash("f0000002.pdf", &pdf());
    tools.stash(
        "report.xml",
        b"<dfxml><fileobject><filename>recup.1/f0000001.png</filename><byte_runs><byte_run offset='0' img_offset='65536' len='69'/></byte_runs></fileobject><fileobject><filename>recup.1/f0000002.pdf</filename><byte_runs><byte_run offset='0' img_offset='131072' len='64'/></byte_runs></fileobject></dfxml>",
    );
    let image_path = temporary.path().join("evidence.raw");
    std::fs::write(&image_path, build_image(1024 * 1024, &[(4096, jpeg())])).unwrap();

    let mut daemon = Daemon::start(&[("RECOVERY_TOOLS_ROOT", &tools.root)]);
    let (case_id, source_id) = create_case_and_source(&mut daemon, temporary.path(), &image_path);
    let (job_id, status) = run_job(&mut daemon, &case_id, &source_id, Some(json!(["images", "documents"])));
    let codes = limitation_codes(&status);
    assert!(!codes.contains(&"PHOTOREC_UNAVAILABLE".to_owned()), "{codes:?}");
    assert!(!codes.contains(&"PHOTOREC_FAILED".to_owned()), "{codes:?}");

    let page = daemon.rpc("artifact.query", json!({ "pageSize": 50 }));
    assert_eq!(page["totalCount"], json!(2));
    assert_eq!(mime_types(&page), vec!["application/pdf", "image/png"]);
    let png_artifact = page["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|artifact| artifact["mimeType"] == "image/png")
        .unwrap();
    assert_eq!(png_artifact["sourceRanges"][0]["offset"], "65536");
    assert_eq!(png_artifact["sourceRanges"][0]["length"], "69");
    assert_eq!(png_artifact["recoveryState"], "complete_validated");

    // The tool transcript is preserved as evidence in the job workspace, and
    // the command line only ever enabled the requested families.
    let case_root = temporary.path().join("case");
    let transcript = case_root.join("work").join(&job_id).join("photorec-run");
    assert!(transcript.join("tool.stdout.log").exists());
    let engine: Value = serde_json::from_slice(&std::fs::read(case_root.join("work").join(&job_id).join("carve-engine.json")).unwrap()).unwrap();
    assert_eq!(engine["engine"], "photorec");
    assert_eq!(engine["version"], "7.2-test");

    let report = daemon.rpc("report.generate", json!({ "caseId": case_id }));
    let report_json = std::fs::read_to_string(report["jsonPath"].as_str().unwrap()).unwrap();
    assert!(report_json.contains("\"photorec\""), "{report_json}");
    assert!(report_json.contains("7.2-test"));
}

#[test]
fn failing_photorec_falls_back_to_the_built_in_engine_with_a_limitation() {
    let temporary = tempdir().unwrap();
    let tools = FakePhotoRec::install(&temporary.path().join("tools"), "fail");
    let image_path = temporary.path().join("evidence.raw");
    let planted = jpeg();
    std::fs::write(&image_path, build_image(1024 * 1024, &[(4096, planted.clone())])).unwrap();

    let mut daemon = Daemon::start(&[("RECOVERY_TOOLS_ROOT", &tools.root)]);
    let (case_id, source_id) = create_case_and_source(&mut daemon, temporary.path(), &image_path);
    let (_, status) = run_job(&mut daemon, &case_id, &source_id, None);
    let codes = limitation_codes(&status);
    assert!(codes.contains(&"PHOTOREC_FAILED".to_owned()), "{codes:?}");
    assert!(!codes.contains(&"PHOTOREC_UNAVAILABLE".to_owned()), "{codes:?}");

    let page = daemon.rpc("artifact.query", json!({ "pageSize": 50 }));
    assert_eq!(page["totalCount"], json!(1));
    assert_eq!(page["items"][0]["mimeType"], "image/jpeg");
    assert_eq!(page["items"][0]["sourceRanges"][0]["offset"], "4096");
    assert_eq!(page["items"][0]["sourceRanges"][0]["length"], planted.len().to_string());
}
