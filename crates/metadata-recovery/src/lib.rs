mod fls_adapter;
mod icat_adapter;
mod path_reconstruction;
mod tsk_parser;

pub use fls_adapter::{FlsInvocation, build_fls_invocation};
pub use icat_adapter::{IcatInvocation, build_icat_invocation, write_extracted_content};
pub use tsk_parser::parse_fls;

use recovery_domain::{
    PreviewStatus, RecoveryArtifact, RecoveryMethod, RecoveryState, ThreatStatus,
};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FlsRecord {
    pub metadata_address: String,
    pub original_path: String,
    pub original_name: String,
    pub extension: Option<String>,
    pub alternate_stream: Option<String>,
    pub raw_record: String,
}

#[derive(Debug, Clone, Default)]
pub struct RecoveryFilters {
    pub name_contains: Option<String>,
    pub former_path_contains: Option<String>,
    pub extensions: Vec<String>,
}

impl RecoveryFilters {
    fn matches(&self, record: &FlsRecord) -> bool {
        let name_matches = self.name_contains.as_ref().is_none_or(|needle| {
            record
                .original_name
                .to_ascii_lowercase()
                .contains(&needle.to_ascii_lowercase())
        });
        let path_matches = self.former_path_contains.as_ref().is_none_or(|needle| {
            record
                .original_path
                .to_ascii_lowercase()
                .contains(&needle.to_ascii_lowercase())
        });
        let extension_matches = self.extensions.is_empty()
            || record.extension.as_ref().is_some_and(|extension| {
                self.extensions
                    .iter()
                    .any(|selected| selected.eq_ignore_ascii_case(extension))
            });
        name_matches && path_matches && extension_matches
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExtentState {
    Readable,
    Missing,
    Overwritten,
}

pub fn classify_completeness(extents: &[ExtentState]) -> RecoveryState {
    if extents.is_empty()
        || extents
            .iter()
            .any(|extent| *extent != ExtentState::Readable)
    {
        RecoveryState::PartialUnverified
    } else {
        RecoveryState::CompleteUnverified
    }
}

pub trait ArtifactSink {
    fn discovered(&mut self, artifact: &RecoveryArtifact);
}

#[derive(Default)]
pub struct MetadataRecovery;

impl MetadataRecovery {
    pub fn normalize_record(
        &self,
        source_id: &str,
        partition_id: &str,
        record: &FlsRecord,
        output: &Path,
        extents: &[ExtentState],
    ) -> Result<RecoveryArtifact, MetadataRecoveryError> {
        let (size, sha256) = write_extracted_content(
            std::fs::File::open(output)?,
            &output.with_extension("recovered"),
        )?;
        Ok(RecoveryArtifact {
            artifact_id: Uuid::now_v7().to_string(),
            source_id: source_id.into(),
            partition_id: Some(partition_id.into()),
            original_name: Some(record.original_name.clone()),
            original_path: Some(record.original_path.clone()),
            display_name: record.original_name.clone(),
            extension: record.extension.clone(),
            mime_type: None,
            size_bytes: size,
            recovery_method: RecoveryMethod::Metadata,
            recovery_state: classify_completeness(extents),
            sha256: Some(sha256),
            source_ranges: Vec::new(),
            threat_status: ThreatStatus::NotScanned,
            preview_status: PreviewStatus::Unsupported,
        })
    }
}

#[derive(Debug, thiserror::Error)]
pub enum MetadataRecoveryError {
    #[error("metadata recovery I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid TSK record: {0}")]
    InvalidRecord(String),
}
