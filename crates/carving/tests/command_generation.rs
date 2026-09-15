use carving::{CarveRequest, FileFamily, build_invocation, collect_output};
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

#[test]
fn full_scan_limits_photorec_to_selected_families_and_output_dir() {
    let request = CarveRequest {
        image_path: PathBuf::from("evidence.raw"),
        job_directory: PathBuf::from("job-1"),
        families: vec![FileFamily::Images, FileFamily::Documents],
    };
    let invocation = build_invocation(&request).unwrap();
    assert_eq!(invocation.tool_id, "photorec");
    assert_eq!(invocation.args[0], "/d");
    assert_eq!(invocation.args[2], "/cmd");
    assert_eq!(invocation.args[3], "evidence.raw");
    let commands = &invocation.args[4];
    assert!(commands.starts_with("partition_none,fileopt,everything,disable,"));
    assert!(commands.contains("jpg,enable"));
    assert!(commands.contains("pdf,enable"));
    assert!(!commands.contains("sqlite,enable"));
    assert!(!commands.contains("exe,enable"));
    assert!(commands.ends_with(",wholespace,search"));
    assert_eq!(commands.matches("zip,enable").count(), 1);
    assert_eq!(
        invocation.output_root,
        PathBuf::from("job-1/photorec-output")
    );
}

#[test]
fn empty_family_selection_is_refused() {
    let request = CarveRequest {
        image_path: PathBuf::from("evidence.raw"),
        job_directory: PathBuf::from("job-1"),
        families: Vec::new(),
    };
    assert!(build_invocation(&request).is_err());
}

#[test]
fn photorec_output_is_collected_with_reported_byte_runs() {
    let root = tempdir().unwrap();
    let output = root.path().join("photorec-output");
    let first = output.join("recup.1");
    let second = output.join("recup.2");
    fs::create_dir_all(&first).unwrap();
    fs::create_dir_all(&second).unwrap();
    fs::write(first.join("f0000012.jpg"), b"\xff\xd8\xff\xd9").unwrap();
    fs::write(first.join("f0000020.pdf"), b"%PDF-1.4 %%EOF").unwrap();
    fs::write(second.join("f0000030.png"), b"png").unwrap();
    fs::write(
        first.join("report.xml"),
        "<dfxml><fileobject><filename>recup.1/f0000012.jpg</filename><filesize>4</filesize><byte_runs><byte_run offset='0' img_offset='65536' len='4'/></byte_runs></fileobject><fileobject><filename>recup.1/f0000020.pdf</filename><byte_runs><byte_run offset='0' img_offset='1024' len='10'/><byte_run offset='10' img_offset='4096' len='4'/></byte_runs></fileobject></dfxml>",
    )
    .unwrap();

    let files = collect_output(&output).unwrap();
    let names: Vec<_> = files
        .iter()
        .map(|file| file.path.file_name().unwrap().to_str().unwrap().to_owned())
        .collect();
    assert_eq!(names, vec!["f0000012.jpg", "f0000020.pdf", "f0000030.png"]);
    assert_eq!(files[0].extension.as_deref(), Some("jpg"));
    assert_eq!(files[0].byte_runs, vec![(65_536, 4)]);
    assert_eq!(files[1].byte_runs, vec![(1024, 10), (4096, 4)]);
    assert!(files[2].byte_runs.is_empty());
    assert_eq!(FileFamily::from_extension("jpg"), Some(FileFamily::Images));
    assert_eq!(FileFamily::from_extension("mystery"), None);
}
