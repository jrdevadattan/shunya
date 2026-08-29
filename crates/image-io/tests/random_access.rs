use image_io::{RawImageReader, SourceReader};
use std::fs;
use tempfile::tempdir;

fn pattern(length: usize, start: usize) -> Vec<u8> {
    (start..start + length)
        .map(|index| (index % 251) as u8)
        .collect()
}

#[tokio::test]
async fn raw_reader_supports_random_access_and_detects_source_change() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("raw-pattern.img");
    fs::write(&path, pattern(2_000_000, 0)).unwrap();
    let reader = RawImageReader::open(&path).await.unwrap();
    let mut buffer = vec![0; 8192];
    reader.read_exact_at(1_048_000, &mut buffer).await.unwrap();
    assert_eq!(buffer, pattern(8192, 1_048_000));
    reader.verify_unchanged().unwrap();
    fs::write(&path, pattern(2_000_001, 0)).unwrap();
    assert!(reader.verify_unchanged().is_err());
}
