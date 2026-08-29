use result_index::{ArtifactIndex, ArtifactQuery, ArtifactRow};
use tempfile::tempdir;

#[test]
fn filters_and_cursor_pagination_are_server_side() {
    let directory = tempdir().unwrap();
    let mut index = ArtifactIndex::open(&directory.path().join("results.sqlite")).unwrap();
    index
        .insert_batch(&[
            ArtifactRow::fixture(
                "a",
                "report.pdf",
                "/Finance/report.pdf",
                "metadata",
                "complete_validated",
                "no_rule_match",
                100,
            ),
            ArtifactRow::fixture(
                "b",
                "photo.jpg",
                "/DCIM/photo.jpg",
                "carving",
                "partial_validated",
                "potential_threat",
                200,
            ),
            ArtifactRow::fixture(
                "c",
                "report-old.pdf",
                "/Archive/report-old.pdf",
                "metadata",
                "complete_validated",
                "no_rule_match",
                300,
            ),
        ])
        .unwrap();
    let first = index
        .query(&ArtifactQuery {
            search: Some("report".into()),
            method: Some("metadata".into()),
            page_size: 1,
            ..Default::default()
        })
        .unwrap();
    assert_eq!(first.items.len(), 1);
    assert!(first.next_cursor.is_some());
    let second = index
        .query(&ArtifactQuery {
            search: Some("report".into()),
            method: Some("metadata".into()),
            page_size: 1,
            cursor: first.next_cursor,
            ..Default::default()
        })
        .unwrap();
    assert_eq!(second.items.len(), 1);
    assert_ne!(first.items[0].artifact_id, second.items[0].artifact_id);
}
