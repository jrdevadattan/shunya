use crate::{ImageIoError, ReadErrorRange, SourceReader};
use async_trait::async_trait;
use sha2::{Digest, Sha256};
use std::fs::{File, Metadata, OpenOptions};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;
use tokio::sync::Semaphore;

#[derive(Debug, Clone, PartialEq, Eq)]
struct SourceIdentity {
    size: u64,
    modified_nanos: u128,
    sample: [u8; 32],
}

pub struct RawImageReader {
    path: PathBuf,
    file: File,
    identity: SourceIdentity,
    concurrency: Arc<Semaphore>,
}

impl RawImageReader {
    pub async fn open(path: &Path) -> Result<Self, ImageIoError> {
        Self::open_with_concurrency(path, 4).await
    }

    pub async fn open_with_concurrency(
        path: &Path,
        max_concurrent_reads: usize,
    ) -> Result<Self, ImageIoError> {
        let file = OpenOptions::new().read(true).write(false).open(path)?;
        let identity = identity(path, &file.metadata()?)?;
        Ok(Self {
            path: path.to_path_buf(),
            file,
            identity,
            concurrency: Arc::new(Semaphore::new(max_concurrent_reads.max(1))),
        })
    }
}

#[async_trait]
impl SourceReader for RawImageReader {
    fn len(&self) -> u64 {
        self.identity.size
    }

    async fn read_exact_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), ImageIoError> {
        let _permit = self
            .concurrency
            .acquire()
            .await
            .expect("semaphore remains open");
        let requested_end = offset
            .checked_add(buffer.len() as u64)
            .ok_or(ImageIoError::OffsetOverflow)?;
        if requested_end > self.identity.size {
            return Err(ImageIoError::ShortRead {
                range: ReadErrorRange {
                    offset: self.identity.size.max(offset),
                    length: requested_end.saturating_sub(self.identity.size.max(offset)),
                },
            });
        }
        let mut read = 0;
        while read < buffer.len() {
            let position = offset
                .checked_add(read as u64)
                .ok_or(ImageIoError::OffsetOverflow)?;
            let count = read_at(&self.file, &mut buffer[read..], position)?;
            if count == 0 {
                return Err(ImageIoError::ShortRead {
                    range: ReadErrorRange {
                        offset: position,
                        length: (buffer.len() - read) as u64,
                    },
                });
            }
            read += count;
        }
        Ok(())
    }

    fn verify_unchanged(&self) -> Result<(), ImageIoError> {
        let metadata = self.file.metadata()?;
        if identity(&self.path, &metadata)? != self.identity {
            return Err(ImageIoError::SourceChanged);
        }
        Ok(())
    }
}

fn identity(path: &Path, metadata: &Metadata) -> Result<SourceIdentity, ImageIoError> {
    let modified_nanos = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let size = metadata.len();
    for position in [0, size.saturating_sub(64 * 1024)] {
        file.seek(SeekFrom::Start(position))?;
        let mut buffer = vec![0; (64 * 1024).min(size.saturating_sub(position) as usize)];
        file.read_exact(&mut buffer)?;
        hasher.update(buffer);
    }
    Ok(SourceIdentity {
        size,
        modified_nanos,
        sample: hasher.finalize().into(),
    })
}

#[cfg(unix)]
fn read_at(file: &File, buffer: &mut [u8], offset: u64) -> std::io::Result<usize> {
    use std::os::unix::fs::FileExt;
    file.read_at(buffer, offset)
}

#[cfg(windows)]
fn read_at(file: &File, buffer: &mut [u8], offset: u64) -> std::io::Result<usize> {
    use std::os::windows::fs::FileExt;
    file.seek_read(buffer, offset)
}
