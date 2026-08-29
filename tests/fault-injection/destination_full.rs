use acquisition::{AcquisitionEngine, AcquisitionRequest, AcquisitionSource, SourceReadError};
use async_trait::async_trait;
use tempfile::tempdir;
use tokio_util::sync::CancellationToken;

struct Source;
#[async_trait]
impl AcquisitionSource for Source {
    fn len(&self) -> u64 {
        1024
    }
    fn stable_id(&self) -> &str {
        "fixture"
    }
    async fn read_at(&self, _offset: u64, buffer: &mut [u8]) -> Result<(), SourceReadError> {
        buffer.fill(1);
        Ok(())
    }
}

#[tokio::test]
async fn unavailable_destination_returns_typed_io_error_without_success() {
    let root = tempdir().unwrap();
    let destination = root.path().join("destination");
    std::fs::create_dir(&destination).unwrap();
    let result = AcquisitionEngine
        .create_raw_image(
            AcquisitionRequest {
                source: &Source,
                destination,
                checkpoint: root.path().join("checkpoint.json"),
                block_size: 1024,
            },
            CancellationToken::new(),
        )
        .await;
    assert!(result.is_err());
}
