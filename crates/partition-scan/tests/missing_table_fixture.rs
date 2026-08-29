use image_io::RawImageReader;
use partition_scan::PartitionScanner;
use std::fs;
use tempfile::tempdir;

#[tokio::test]
async fn missing_table_returns_candidates_without_writing_a_table() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("missing-table.img");
    let mut image = vec![0_u8; 3 * 1024 * 1024];
    let offset = 2048 * 512;
    image[offset + 3..offset + 11].copy_from_slice(b"NTFS    ");
    fs::write(&path, image).unwrap();
    let reader = RawImageReader::open(&path).await.unwrap();
    let result = PartitionScanner::default().scan(&reader).await.unwrap();
    assert!(result.partitions.is_empty());
    assert_eq!(result.candidates[0].start_sector, 2048);
    assert_eq!(result.candidates[0].filesystem.as_deref(), Some("NTFS"));
}
