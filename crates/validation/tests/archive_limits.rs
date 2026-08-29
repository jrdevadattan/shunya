use validation::{ArchiveEntry, ArchiveLimits, validate_archive_entries};

#[test]
fn archive_path_traversal_expansion_depth_and_count_are_blocked() {
    let limits = ArchiveLimits::default();
    assert!(
        validate_archive_entries(
            &[ArchiveEntry {
                path: "../../escape.exe".into(),
                compressed_size: 1,
                uncompressed_size: 1
            }],
            &limits
        )
        .is_err()
    );
    assert!(
        validate_archive_entries(
            &[ArchiveEntry {
                path: "safe.bin".into(),
                compressed_size: 1,
                uncompressed_size: 10_001
            }],
            &limits
        )
        .is_err()
    );
    assert!(
        validate_archive_entries(
            &[ArchiveEntry {
                path: "a/b/c/d/e/f/g/h/i/file".into(),
                compressed_size: 1,
                uncompressed_size: 1
            }],
            &limits
        )
        .is_err()
    );
    let many = (0..limits.max_entries + 1)
        .map(|index| ArchiveEntry {
            path: format!("{index}.txt"),
            compressed_size: 1,
            uncompressed_size: 1,
        })
        .collect::<Vec<_>>();
    assert!(validate_archive_entries(&many, &limits).is_err());
}
