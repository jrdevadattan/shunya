use carving::{CarveRequest, FileFamily, build_invocation};
use std::path::PathBuf;

#[test]
fn full_scan_limits_photorec_to_selected_families_and_output_dir() {
    let request = CarveRequest {
        image_path: PathBuf::from("evidence.raw"),
        job_directory: PathBuf::from("job-1"),
        families: vec![FileFamily::Jpeg, FileFamily::Pdf],
    };
    let invocation = build_invocation(&request).unwrap();
    assert!(invocation.args.iter().any(|arg| arg.contains("fileopt")));
    assert!(invocation.args.iter().any(|arg| arg.contains("jpg,enable")));
    assert_eq!(
        invocation.output_root,
        PathBuf::from("job-1/photorec-output")
    );
}
