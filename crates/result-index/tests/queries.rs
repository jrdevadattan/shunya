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

#[test]
fn original_path_prefix_uses_normalized_folder_boundaries_and_preserves_pagination() {
    let directory = tempdir().unwrap();
    let mut index = ArtifactIndex::open(&directory.path().join("results.sqlite")).unwrap();
    let mut pathless = ArtifactRow::fixture(
        "f",
        "Users pathless bait",
        "/ignored",
        "metadata",
        "complete_validated",
        "no_rule_match",
        1,
    );
    pathless.original_path = None;
    let mut mime_bait = ArtifactRow::fixture(
        "g",
        "mime-bait.bin",
        "/Archive/mime-bait.bin",
        "metadata",
        "complete_validated",
        "no_rule_match",
        1,
    );
    mime_bait.mime_type = Some("application/users".into());
    index
        .insert_batch(&[
            ArtifactRow::fixture(
                "a",
                "one.txt",
                "Users\\Maya\\one.txt",
                "metadata",
                "complete_validated",
                "no_rule_match",
                1,
            ),
            ArtifactRow::fixture(
                "b",
                "two.txt",
                "/Users/Maya/two.txt",
                "metadata",
                "complete_validated",
                "no_rule_match",
                1,
            ),
            ArtifactRow::fixture(
                "c",
                "three.txt",
                "/Users2/three.txt",
                "metadata",
                "complete_validated",
                "no_rule_match",
                1,
            ),
            ArtifactRow::fixture(
                "d",
                "Users display bait",
                "/Archive/four.txt",
                "metadata",
                "complete_validated",
                "no_rule_match",
                1,
            ),
            ArtifactRow::fixture(
                "e",
                "carved.txt",
                "/Users/Maya/carved.txt",
                "carving",
                "complete_validated",
                "no_rule_match",
                1,
            ),
            pathless,
            mime_bait,
        ])
        .unwrap();

    let first_query = ArtifactQuery {
        original_path_prefix: Some("\\Users\\Maya\\".into()),
        page_size: 1,
        ..Default::default()
    };
    assert_eq!(index.count(&first_query).unwrap(), 2);
    let first = index.query(&first_query).unwrap();
    assert_eq!(
        first
            .items
            .iter()
            .map(|row| row.artifact_id.as_str())
            .collect::<Vec<_>>(),
        ["a"]
    );
    assert!(first.next_cursor.is_some());

    let second = index
        .query(&ArtifactQuery {
            cursor: first.next_cursor,
            ..first_query
        })
        .unwrap();
    assert_eq!(
        second
            .items
            .iter()
            .map(|row| row.artifact_id.as_str())
            .collect::<Vec<_>>(),
        ["b"]
    );
    assert!(second.next_cursor.is_none());
}
