use image_io::{EwfToolAdapter, discover_segments};
use tempfile::tempdir;

#[test]
fn ewf_missing_middle_segment_is_reported_and_verifier_preserves_raw_output() {
    let root = tempdir().unwrap();
    std::fs::write(root.path().join("small.E01"), b"fixture segment 1").unwrap();
    std::fs::write(root.path().join("small.E03"), b"fixture segment 3").unwrap();
    let error = discover_segments(&root.path().join("small.E01")).unwrap_err();
    assert!(error.to_string().contains("MISSING_SEGMENT"));
    let outcome = EwfToolAdapter.normalize_verification(
        Some(1),
        &["Verification started".into()],
        &["checksum mismatch".into()],
    );
    assert!(!outcome.verified);
    assert!(
        outcome
            .raw_output
            .iter()
            .any(|line| line.contains("checksum mismatch"))
    );
}

#[test]
fn ewf_contiguous_segments_are_sorted() {
    let root = tempdir().unwrap();
    for extension in ["E01", "E02"] {
        std::fs::write(root.path().join(format!("small.{extension}")), extension).unwrap();
    }
    let segments = discover_segments(&root.path().join("small.E01")).unwrap();
    assert_eq!(segments.len(), 2);
    assert!(segments[1].ends_with("small.E02"));
}
