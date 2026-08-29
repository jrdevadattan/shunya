use result_index::{ArtifactIndex, ArtifactQuery};
use std::time::{Duration, Instant};
use tempfile::tempdir;

#[test]
fn indexed_first_page_scales_to_one_million_rows() {
    let directory = tempdir().unwrap();
    let mut index = ArtifactIndex::open(&directory.path().join("results.sqlite")).unwrap();
    index.seed_generated(1_000_000).unwrap();
    let started = Instant::now();
    let page = index
        .query(&ArtifactQuery {
            search: Some("report-999999".into()),
            page_size: 100,
            ..Default::default()
        })
        .unwrap();
    println!("one-million-row first-page search: {:?}", started.elapsed());
    assert_eq!(page.items.len(), 1);
    assert!(
        started.elapsed() < Duration::from_secs(5),
        "query took {:?}",
        started.elapsed()
    );
}
