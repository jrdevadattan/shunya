use acquisition::{
    AcquisitionEngine, AcquisitionRequest, AcquisitionSource, AcquisitionStatus, SourceReadError,
};
use async_trait::async_trait;
use std::time::Instant;
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;

struct SequentialFixture(Vec<u8>);
#[async_trait]
impl AcquisitionSource for SequentialFixture {
    fn len(&self) -> u64 {
        self.0.len() as u64
    }
    fn stable_id(&self) -> &str {
        "performance-fixture-v1"
    }
    async fn read_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), SourceReadError> {
        buffer.copy_from_slice(&self.0[offset as usize..offset as usize + buffer.len()]);
        Ok(())
    }
}

#[tokio::test]
async fn raw_copy_hash_and_checkpoint_stay_above_reference_floor() {
    let source = SequentialFixture(vec![0x5a; performance_tests::REFERENCE_FIXTURE_BYTES]);
    let root = tempdir().unwrap();
    let started = Instant::now();
    let result = AcquisitionEngine
        .create_raw_image(
            AcquisitionRequest {
                source: &source,
                destination: root.path().join("reference.raw"),
                checkpoint: root.path().join("reference.checkpoint.json"),
                block_size: 4 * 1024 * 1024,
            },
            CancellationToken::new(),
        )
        .await
        .unwrap();
    let elapsed = started.elapsed();
    let mib_per_second = source.len() as f64 / 1024.0 / 1024.0 / elapsed.as_secs_f64();
    println!("raw acquisition + SHA-256 + checkpoint: {mib_per_second:.1} MiB/s ({elapsed:?})");
    assert_eq!(result.status, AcquisitionStatus::Success);
    assert!(
        mib_per_second >= 1.0,
        "reference floor missed: {mib_per_second:.1} MiB/s"
    );
}
