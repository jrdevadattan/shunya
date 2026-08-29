mod model;
mod registry;
mod validators;

pub use model::{SafePreviewKind, ValidationHints, ValidationOutcome};
pub use registry::ValidatorRegistry;

#[derive(Debug, Clone)]
pub struct ArchiveEntry {
    pub path: String,
    pub compressed_size: u64,
    pub uncompressed_size: u64,
}

#[derive(Debug, Clone)]
pub struct ArchiveLimits {
    pub max_entries: usize,
    pub max_depth: usize,
    pub max_expansion_ratio: u64,
}

impl Default for ArchiveLimits {
    fn default() -> Self {
        Self {
            max_entries: 10_000,
            max_depth: 8,
            max_expansion_ratio: 1_000,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ArchiveSafetyError {
    #[error("archive contains an unsafe path")]
    UnsafePath,
    #[error("archive exceeds the entry limit")]
    TooManyEntries,
    #[error("archive exceeds the nesting limit")]
    TooDeep,
    #[error("archive exceeds the expansion ratio limit")]
    ExpansionRatio,
}

pub fn validate_archive_entries(
    entries: &[ArchiveEntry],
    limits: &ArchiveLimits,
) -> Result<(), ArchiveSafetyError> {
    if entries.len() > limits.max_entries {
        return Err(ArchiveSafetyError::TooManyEntries);
    }
    for entry in entries {
        let normalized = entry.path.replace('\\', "/");
        if normalized.starts_with('/')
            || normalized.contains(':')
            || normalized.split('/').any(|part| part == "..")
        {
            return Err(ArchiveSafetyError::UnsafePath);
        }
        if normalized
            .split('/')
            .filter(|part| !part.is_empty())
            .count()
            > limits.max_depth
        {
            return Err(ArchiveSafetyError::TooDeep);
        }
        if entry.compressed_size == 0
            || entry.uncompressed_size / entry.compressed_size > limits.max_expansion_ratio
        {
            return Err(ArchiveSafetyError::ExpansionRatio);
        }
    }
    Ok(())
}
