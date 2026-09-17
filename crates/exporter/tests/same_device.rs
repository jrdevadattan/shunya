use exporter::{ExportItem, ExportRequest, Exporter};
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn same_physical_device_is_rejected_before_any_output_is_written() {
    let source = tempdir().unwrap();
    let destination = tempdir().unwrap();
    let input = source.path().join("report.pdf");
    std::fs::write(&input, b"forensic fixture").unwrap();

    let result = Exporter
        .export(
            ExportRequest {
                export_root: destination.path().to_path_buf(),
                source_physical_id: "disk-7".into(),
                destination_physical_id: "disk-7".into(),
                acknowledge_unsafe: false,
                items: vec![ExportItem {
                    artifact_id: "a1".into(),
                    source_path: input,
                    desired_path: "Finance/report.pdf".into(),
                    expected_sha256: None,
                    potentially_unsafe: false,
                }],
            },
            CancellationToken::new(),
        )
        .await;

    assert!(result.is_err());
    assert_eq!(std::fs::read_dir(destination.path()).unwrap().count(), 0);
}
