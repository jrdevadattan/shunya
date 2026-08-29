use async_trait::async_trait;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ReadErrorRange {
    pub offset: u64,
    pub length: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum ImageIoError {
    #[error("image I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("offset arithmetic overflow")]
    OffsetOverflow,
    #[error("short read at offset {range:?}")]
    ShortRead { range: ReadErrorRange },
    #[error("split image segment is missing: {0}")]
    MissingSegment(String),
    #[error("source identity changed during analysis")]
    SourceChanged,
    #[error("split image requires at least one segment")]
    NoSegments,
}

#[async_trait]
pub trait SourceReader: Send + Sync {
    fn len(&self) -> u64;
    fn is_empty(&self) -> bool {
        self.len() == 0
    }
    async fn read_exact_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), ImageIoError>;
    fn verify_unchanged(&self) -> Result<(), ImageIoError>;
}
