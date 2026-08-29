use acquisition::{AcquisitionEngine, AcquisitionRequest, AcquisitionSource, SourceReadError};
use async_trait::async_trait;
use std::sync::atomic::{AtomicUsize, Ordering};
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;

struct ReplacedSource {
    validations: AtomicUsize,
}
#[async_trait]
impl AcquisitionSource for ReplacedSource {
    fn len(&self) -> u64 {
        2048
    }
    fn stable_id(&self) -> &str {
        "serial-a:size-2048"
    }
    async fn read_at(&self, _offset: u64, buffer: &mut [u8]) -> Result<(), SourceReadError> {
        buffer.fill(7);
        Ok(())
    }
    fn revalidate(&self) -> Result<(), SourceReadError> {
        if self.validations.fetch_add(1, Ordering::SeqCst) > 0 {
            Err(SourceReadError)
        } else {
            Ok(())
        }
    }
}

#[tokio::test]
async fn source_disconnect_or_replacement_stops_at_revalidation_boundary() {
    let root = tempdir().unwrap();
    let source = ReplacedSource {
        validations: AtomicUsize::new(0),
    };
    let result = AcquisitionEngine
        .create_raw_image(
            AcquisitionRequest {
                source: &source,
                destination: root.path().join("source.raw"),
                checkpoint: root.path().join("source.checkpoint.json"),
                block_size: 1024,
            },
            CancellationToken::new(),
        )
        .await;
    assert!(result.is_err());
    assert!(root.path().join("source.checkpoint.json").exists());
}
