use acquisition::{
    AcquisitionEngine, AcquisitionRequest, AcquisitionSource, AcquisitionStatus, SourceReadError,
};
use async_trait::async_trait;
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;

struct DamagedFixture(Vec<u8>);
#[async_trait]
impl AcquisitionSource for DamagedFixture {
    fn len(&self) -> u64 {
        self.0.len() as u64
    }
    fn stable_id(&self) -> &str {
        "damaged-fixture"
    }
    async fn read_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), SourceReadError> {
        if offset == 1024 {
            return Err(SourceReadError);
        }
        buffer.copy_from_slice(&self.0[offset as usize..offset as usize + buffer.len()]);
        Ok(())
    }
}

#[tokio::test]
async fn read_errors_create_zero_filled_gap_and_partial_result() {
    let root = tempdir().unwrap();
    let source = DamagedFixture(vec![7; 3072]);
    let result = AcquisitionEngine
        .create_raw_image(
            AcquisitionRequest {
                source: &source,
                destination: root.path().join("partial.raw"),
                checkpoint: root.path().join("partial.checkpoint.json"),
                block_size: 1024,
            },
            CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(result.status, AcquisitionStatus::Partial);
    assert_eq!(result.unreadable_ranges[0].offset, 1024);
    assert!(
        std::fs::read(root.path().join("partial.raw")).unwrap()[1024..2048]
            .iter()
            .all(|byte| *byte == 0)
    );
}
