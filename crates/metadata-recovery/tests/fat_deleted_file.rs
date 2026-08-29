use metadata_recovery::{RecoveryFilters, parse_fls};

#[test]
fn filters_deleted_fat_results_by_name_and_extension() {
    let raw = "r/r * 44: DCIM/photo.jpg\nr/r * 45: docs/report.pdf\n";
    let records = parse_fls(
        raw,
        &RecoveryFilters {
            name_contains: Some("photo".into()),
            extensions: vec!["jpg".into()],
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].original_path, "/DCIM/photo.jpg");
}
