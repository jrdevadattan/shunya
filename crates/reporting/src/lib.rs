mod manifest;
mod markdown;

pub use manifest::{ExportRecord, RecoveryReportManifest, ToolRecord};

pub struct GeneratedReport {
    pub json: String,
    pub markdown: String,
}

pub fn generate_report(
    manifest: &RecoveryReportManifest,
) -> Result<GeneratedReport, ReportingError> {
    if manifest.source_hash_before.is_some()
        && manifest.source_hash_before != manifest.source_hash_after
    {
        return Err(ReportingError::SourceHashChanged);
    }
    Ok(GeneratedReport {
        json: serde_json::to_string_pretty(manifest)?,
        markdown: markdown::render(manifest),
    })
}

#[derive(Debug, thiserror::Error)]
pub enum ReportingError {
    #[error("source hash changed during analysis; the case needs attention")]
    SourceHashChanged,
    #[error("report JSON error: {0}")]
    Json(#[from] serde_json::Error),
}
