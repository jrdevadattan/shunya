use image_io::{SourceReader, SplitImageReader};
use std::fs;
use tempfile::tempdir;

fn pattern(length: usize, start: usize) -> Vec<u8> {
    (start..start + length)
        .map(|index| (index % 251) as u8)
        .collect()
}

#[tokio::test]
async fn reads_across_non_aligned_split_segment_boundary() {
    let directory = tempdir().unwrap();
    let boundary = 1_050_123;
    fs::write(
        directory.path().join("split-pattern.001"),
        pattern(boundary, 0),
    )
    .unwrap();
    fs::write(
        directory.path().join("split-pattern.002"),
        pattern(1_000_000, boundary),
    )
    .unwrap();
    let reader = SplitImageReader::open(&[
        directory.path().join("split-pattern.001"),
        directory.path().join("split-pattern.002"),
    ])
    .await
    .unwrap();
    let mut buffer = vec![0; 8192];
    reader.read_exact_at(1_048_000, &mut buffer).await.unwrap();
    assert_eq!(buffer, pattern(8192, 1_048_000));
}

#[tokio::test]
async fn a_missing_numbered_segment_is_a_typed_gap() {
    let directory = tempdir().unwrap();
    let first = directory.path().join("split-pattern.001");
    let third = directory.path().join("split-pattern.003");
    fs::write(&first, pattern(10, 0)).unwrap();
    fs::write(&third, pattern(10, 20)).unwrap();
    assert!(SplitImageReader::open(&[first, third]).await.is_err());
}
