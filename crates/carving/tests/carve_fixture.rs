use carving::normalize_carved_file;
use recovery_domain::RecoveryMethod;
use std::fs;
use tempfile::tempdir;

#[test]
fn carved_file_has_no_invented_original_name_or_path() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("f0000123.jpg");
    fs::write(&path, b"fixture jpeg").unwrap();
    let artifact = normalize_carved_file("source", &path, "jpeg").unwrap();
    assert_eq!(artifact.recovery_method, RecoveryMethod::Carving);
    assert!(artifact.original_name.is_none());
    assert!(artifact.original_path.is_none());
    assert_eq!(artifact.display_name, "Recovered JPEG 0000123");
}
