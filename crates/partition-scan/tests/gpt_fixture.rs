use image_io::RawImageReader;
use partition_scan::PartitionScanner;
use std::fs;
use tempfile::tempdir;

#[tokio::test]
async fn reports_partition_offsets_in_bytes_and_sectors() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("gpt-basic.img");
    let mut image = vec![0_u8; 4 * 1024 * 1024];
    image[510] = 0x55;
    image[511] = 0xaa;
    image[446 + 4] = 0xee;
    image[512..520].copy_from_slice(b"EFI PART");
    image[512 + 72..512 + 80].copy_from_slice(&2_u64.to_le_bytes());
    image[512 + 80..512 + 84].copy_from_slice(&4_u32.to_le_bytes());
    image[512 + 84..512 + 88].copy_from_slice(&128_u32.to_le_bytes());
    let entry = 1024;
    image[entry] = 0xa2;
    image[entry + 32..entry + 40].copy_from_slice(&2048_u64.to_le_bytes());
    image[entry + 40..entry + 48].copy_from_slice(&4095_u64.to_le_bytes());
    fs::write(&path, image).unwrap();
    let reader = RawImageReader::open(&path).await.unwrap();
    let result = PartitionScanner::default().scan(&reader).await.unwrap();
    assert_eq!(result.partitions[0].start_sector, 2048);
    assert_eq!(result.partitions[0].start_offset_bytes, 1_048_576);
}
