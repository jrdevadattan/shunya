use source_inventory::{ImageFindingCode, identify_image};
use std::fs;
use tempfile::tempdir;

#[test]
fn replacing_an_image_at_the_same_path_changes_stable_id() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("disk.raw");
    fs::write(&path, b"first").unwrap();
    let first = identify_image(&path).unwrap();
    fs::write(&path, b"second and different").unwrap();
    let second = identify_image(&path).unwrap();
    assert_ne!(first.descriptor.stable_id, second.descriptor.stable_id);
}

#[test]
fn split_image_gap_is_reported_and_not_silently_concatenated() {
    let directory = tempdir().unwrap();
    for segment in ["disk.001", "disk.002", "disk.004"] {
        fs::write(directory.path().join(segment), segment).unwrap();
    }
    let image = identify_image(&directory.path().join("disk.001")).unwrap();
    assert!(
        image
            .findings
            .iter()
            .any(|finding| finding.code == ImageFindingCode::MissingSegment
                && finding.detail.contains("disk.003"))
    );
    assert!(image.segments.is_empty());
}

#[test]
fn directories_and_unsupported_extensions_are_rejected() {
    let directory = tempdir().unwrap();
    assert!(identify_image(directory.path()).is_err());
    let unsupported = directory.path().join("disk.e01");
    fs::write(&unsupported, b"ewf later").unwrap();
    assert!(identify_image(&unsupported).is_err());
}
