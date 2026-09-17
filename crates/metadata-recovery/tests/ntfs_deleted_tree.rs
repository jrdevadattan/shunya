use metadata_recovery::{RecoveryFilters, parse_fls};

#[test]
fn recovers_deleted_ntfs_file_with_original_path_and_distinct_links() {
    let raw = "d/d 100-144-1: Finance\nr/r * 128-128-1: Finance/2025/report.pdf\nr/r * 128-128-1: Links/report-link.pdf\nr/r * 129-128-2: Finance/secret.txt:Zone.Identifier\n";
    let records = parse_fls(raw, &RecoveryFilters::default()).unwrap();
    assert_eq!(records[0].original_path, "/Finance/2025/report.pdf");
    assert_eq!(records[1].metadata_address, records[0].metadata_address);
    assert_ne!(records[1].original_path, records[0].original_path);
    assert_eq!(
        records[2].alternate_stream.as_deref(),
        Some("Zone.Identifier")
    );
}
