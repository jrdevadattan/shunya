mod builtin;
mod config;
mod normalize;
mod output_watcher;
mod photorec;

pub use builtin::{CarvedHit, carve_signatures, supported_formats};
pub use config::{CarveRequest, FileFamily, PhotoRecInvocation};
pub use normalize::normalize_carved_file;
pub use output_watcher::stable_output_files;
pub use photorec::{PhotoRecFile, build_invocation, collect_output};

#[derive(Debug, thiserror::Error)]
pub enum CarvingError {
    #[error("select at least one file family")]
    NoFileFamilies,
    #[error("carving I/O error: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CarveStatus {
    Completed,
    PartialCancelled,
}

#[derive(Default)]
pub struct Carver;
