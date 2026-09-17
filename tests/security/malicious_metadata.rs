use exporter::safe_relative_path;
use validation::{ArchiveEntry, ArchiveLimits, ArchiveSafetyError, validate_archive_entries};

#[test]
fn hostile_names_are_bounded_and_never_interpreted_as_paths() {
    let invalid_utf8 = String::from_utf8_lossy(&[0xff, b'.', b't', b'x', b't']).into_owned();
    let names = [
        format!("{}.txt", "a".repeat(20_000)),
        "<script>alert(1)<script>.txt".into(),
        "CON .".into(),
        invalid_utf8,
    ];
    for name in names {
        let safe = safe_relative_path(&name).unwrap();
        assert!(safe.file_name().unwrap().to_string_lossy().chars().count() <= 240);
        assert_eq!(safe.components().count(), 1);
    }
}

#[test]
fn archive_traversal_and_bombs_are_refused_before_preview() {
    let limits = ArchiveLimits::default();
    let traversal = [ArchiveEntry {
        path: "../../escape.exe".into(),
        compressed_size: 1,
        uncompressed_size: 1,
    }];
    assert!(matches!(
        validate_archive_entries(&traversal, &limits),
        Err(ArchiveSafetyError::UnsafePath)
    ));
    let bomb = [ArchiveEntry {
        path: "large.bin".into(),
        compressed_size: 1,
        uncompressed_size: 100_000,
    }];
    assert!(matches!(
        validate_archive_entries(&bomb, &limits),
        Err(ArchiveSafetyError::ExpansionRatio)
    ));
}
