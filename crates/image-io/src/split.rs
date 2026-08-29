use crate::{ImageIoError, RawImageReader, SourceReader};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Semaphore;

pub struct SplitImageReader {
    segments: Vec<(u64, RawImageReader)>,
    length: u64,
    concurrency: Arc<Semaphore>,
}

impl SplitImageReader {
    pub async fn open(paths: &[PathBuf]) -> Result<Self, ImageIoError> {
        if paths.is_empty() {
            return Err(ImageIoError::NoSegments);
        }
        validate_sequence(paths)?;
        let mut segments = Vec::new();
        let mut length = 0_u64;
        for path in paths {
            let reader = RawImageReader::open(path).await?;
            segments.push((length, reader));
            length = length
                .checked_add(segments.last().unwrap().1.len())
                .ok_or(ImageIoError::OffsetOverflow)?;
        }
        Ok(Self {
            segments,
            length,
            concurrency: Arc::new(Semaphore::new(4)),
        })
    }
}

#[async_trait]
impl SourceReader for SplitImageReader {
    fn len(&self) -> u64 {
        self.length
    }

    async fn read_exact_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), ImageIoError> {
        let _permit = self
            .concurrency
            .acquire()
            .await
            .expect("semaphore remains open");
        let end = offset
            .checked_add(buffer.len() as u64)
            .ok_or(ImageIoError::OffsetOverflow)?;
        if end > self.length {
            return Err(ImageIoError::ShortRead {
                range: crate::ReadErrorRange {
                    offset: self.length.max(offset),
                    length: end.saturating_sub(self.length.max(offset)),
                },
            });
        }
        let mut written = 0;
        let mut position = offset;
        while written < buffer.len() {
            let (start, reader) = self
                .segments
                .iter()
                .rev()
                .find(|(start, _)| *start <= position)
                .ok_or_else(|| ImageIoError::MissingSegment(position.to_string()))?;
            let local = position - start;
            let available = (reader.len() - local) as usize;
            let count = available.min(buffer.len() - written);
            reader
                .read_exact_at(local, &mut buffer[written..written + count])
                .await?;
            written += count;
            position = position
                .checked_add(count as u64)
                .ok_or(ImageIoError::OffsetOverflow)?;
        }
        Ok(())
    }

    fn verify_unchanged(&self) -> Result<(), ImageIoError> {
        for (_, segment) in &self.segments {
            segment.verify_unchanged()?;
        }
        Ok(())
    }
}

fn validate_sequence(paths: &[PathBuf]) -> Result<(), ImageIoError> {
    let mut previous = None;
    for path in paths {
        let number = numbered_extension(path)?;
        if let Some(previous) = previous
            && number != previous + 1
        {
            return Err(ImageIoError::MissingSegment(format!(
                "expected segment .{:03}",
                previous + 1
            )));
        }
        previous = Some(number);
    }
    Ok(())
}

fn numbered_extension(path: &Path) -> Result<u32, ImageIoError> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if extension.len() != 3 || !extension.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(ImageIoError::MissingSegment(path.display().to_string()));
    }
    Ok(extension.parse().expect("validated numeric extension"))
}
