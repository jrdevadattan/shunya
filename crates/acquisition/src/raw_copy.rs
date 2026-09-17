use crate::checkpoint::{AcquisitionCheckpoint, UnreadableRange};
use crate::hash::sha256;
use async_trait::async_trait;
use std::fs::OpenOptions;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use tokio_util::sync::CancellationToken;

pub const DEFAULT_BLOCK_SIZE: usize = 4 * 1024 * 1024;

#[async_trait]
pub trait AcquisitionSource: Send + Sync {
    fn len(&self) -> u64;
    fn is_empty(&self) -> bool {
        self.len() == 0
    }
    fn stable_id(&self) -> &str;
    async fn read_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), SourceReadError>;
    fn revalidate(&self) -> Result<(), SourceReadError> {
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
#[error("source read failed")]
pub struct SourceReadError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AcquisitionStatus {
    Success,
    Partial,
    Cancelled,
}

#[derive(Debug)]
pub struct AcquisitionResult {
    pub status: AcquisitionStatus,
    pub sha256: String,
    pub unreadable_ranges: Vec<UnreadableRange>,
    pub bytes_copied: u64,
    pub chunks_reused: u64,
}

pub struct AcquisitionRequest<'a> {
    pub source: &'a dyn AcquisitionSource,
    pub destination: PathBuf,
    pub checkpoint: PathBuf,
    pub block_size: usize,
}

#[derive(Default)]
pub struct AcquisitionEngine;

impl AcquisitionEngine {
    pub async fn create_raw_image(
        &self,
        request: AcquisitionRequest<'_>,
        cancellation: CancellationToken,
    ) -> Result<AcquisitionResult, AcquisitionError> {
        request.source.revalidate()?;
        let block_size = request.block_size.max(512);
        let total = request.source.len();
        let mut checkpoint =
            AcquisitionCheckpoint::load(&request.checkpoint)?.unwrap_or_else(|| {
                AcquisitionCheckpoint {
                    stable_id: request.source.stable_id().into(),
                    total_bytes: total,
                    ..Default::default()
                }
            });
        if checkpoint.stable_id != request.source.stable_id() || checkpoint.total_bytes != total {
            return Err(AcquisitionError::SourceChanged);
        }
        let mut output = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .truncate(false)
            .open(&request.destination)?;
        output.set_len(total)?;
        let mut chunks_reused = 0;
        let mut offset = 0_u64;
        while offset < total {
            if cancellation.is_cancelled() {
                checkpoint.save(&request.checkpoint)?;
                return finalize(
                    &request.destination,
                    checkpoint,
                    AcquisitionStatus::Cancelled,
                    offset,
                    chunks_reused,
                );
            }
            let length = block_size.min((total - offset) as usize);
            if let Some(expected) = checkpoint.completed_chunks.get(&offset) {
                let mut existing = vec![0_u8; length];
                output.seek(SeekFrom::Start(offset))?;
                if output.read_exact(&mut existing).is_ok() && &sha256(&existing) == expected {
                    chunks_reused += 1;
                    offset += length as u64;
                    continue;
                }
            }
            let mut buffer = vec![0_u8; length];
            if request.source.read_at(offset, &mut buffer).await.is_err() {
                checkpoint.unreadable_ranges.push(UnreadableRange {
                    offset,
                    length: length as u64,
                });
            }
            output.seek(SeekFrom::Start(offset))?;
            output.write_all(&buffer)?;
            checkpoint.completed_chunks.insert(offset, sha256(&buffer));
            output.sync_data()?;
            checkpoint.save(&request.checkpoint)?;
            offset += length as u64;
            request.source.revalidate()?;
        }
        output.sync_all()?;
        let status = if checkpoint.unreadable_ranges.is_empty() {
            AcquisitionStatus::Success
        } else {
            AcquisitionStatus::Partial
        };
        finalize(
            &request.destination,
            checkpoint,
            status,
            total,
            chunks_reused,
        )
    }
}

fn finalize(
    path: &Path,
    checkpoint: AcquisitionCheckpoint,
    status: AcquisitionStatus,
    bytes_copied: u64,
    chunks_reused: u64,
) -> Result<AcquisitionResult, AcquisitionError> {
    let bytes = std::fs::read(path)?;
    Ok(AcquisitionResult {
        status,
        sha256: sha256(&bytes),
        unreadable_ranges: checkpoint.unreadable_ranges,
        bytes_copied,
        chunks_reused,
    })
}

#[derive(Debug, thiserror::Error)]
pub enum AcquisitionError {
    #[error("acquisition I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("source identity changed")]
    SourceChanged,
    #[error("source read error")]
    Read(#[from] SourceReadError),
}
