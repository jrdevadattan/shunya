use reporting::{RecoveryReportManifest, generate_report};

#[test]
fn report_contains_provenance_counts_warnings_exports_and_limitations() {
    let manifest = RecoveryReportManifest::fixture();
    let report = generate_report(&manifest).unwrap();
    assert!(report.markdown.contains("Case case-26149"));
    assert!(report.markdown.contains("Source geometry"));
    assert!(report.markdown.contains("Unreadable ranges"));
    assert!(report.markdown.contains("Limitations"));
    assert!(report.json.contains("\"sourceHashBefore\""));
    assert_eq!(manifest.source_hash_before, manifest.source_hash_after);
}
