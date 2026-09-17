use acquisition::{
    AcquisitionEngine, AcquisitionRequest, AcquisitionSource, AcquisitionStatus, SourceReadError,
};
use async_trait::async_trait;
use std::sync::atomic::{AtomicUsize, Ordering};
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;

struct Fixture {
    bytes: Vec<u8>,
    reads: AtomicUsize,
}
#[async_trait]
impl AcquisitionSource for Fixture {
    fn len(&self) -> u64 {
        self.bytes.len() as u64
    }
    fn stable_id(&self) -> &str {
        "fixture-disk-1"
    }
    async fn read_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), SourceReadError> {
        self.reads.fetch_add(1, Ordering::SeqCst);
        buffer.copy_from_slice(&self.bytes[offset as usize..offset as usize + buffer.len()]);
        Ok(())
    }
}

#[tokio::test]
async fn completed_checkpoint_chunks_are_verified_and_reused() {
    let root = tempdir().unwrap();
    let fixture = Fixture {
        bytes: (0..4096).map(|n| (n % 251) as u8).collect(),
        reads: AtomicUsize::new(0),
    };
    let request = || AcquisitionRequest {
        source: &fixture,
        destination: root.path().join("image.raw"),
        checkpoint: root.path().join("image.checkpoint.json"),
        block_size: 1024,
    };
    let first = AcquisitionEngine
        .create_raw_image(request(), CancellationToken::new())
        .await
        .unwrap();
    assert_eq!(first.status, AcquisitionStatus::Success);
    assert_eq!(fixture.reads.load(Ordering::SeqCst), 4);
    let second = AcquisitionEngine
        .create_raw_image(request(), CancellationToken::new())
        .await
        .unwrap();
    assert_eq!(second.chunks_reused, 4);
    assert_eq!(fixture.reads.load(Ordering::SeqCst), 4);
}
