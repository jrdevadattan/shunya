mod collision;
mod path_safety;
mod verify;

pub use collision::CollisionResolver;
pub use path_safety::safe_relative_path;
pub use verify::sha256;

use std::fs;
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;

pub struct ExportItem {
    pub artifact_id: String,
    pub source_path: PathBuf,
    pub desired_path: String,
    pub expected_sha256: Option<String>,
    pub potentially_unsafe: bool,
}
pub struct ExportRequest {
    pub export_root: PathBuf,
    pub source_physical_id: String,
    pub destination_physical_id: String,
    pub acknowledge_unsafe: bool,
    pub items: Vec<ExportItem>,
}

#[derive(Debug, Clone)]
pub struct ExportVerification {
    pub artifact_id: String,
    pub output_path: PathBuf,
    pub sha256: String,
    pub verified: bool,
}

#[derive(Default)]
pub struct Exporter;

impl Exporter {
    pub async fn export(
        &self,
        request: ExportRequest,
        cancellation: CancellationToken,
    ) -> Result<Vec<ExportVerification>, ExportError> {
        if request.source_physical_id == request.destination_physical_id {
            return Err(ExportError::SamePhysicalDevice);
        }
        if request.items.iter().any(|item| item.potentially_unsafe) && !request.acknowledge_unsafe {
            return Err(ExportError::UnsafeAcknowledgementRequired);
        }
        let mut resolver = CollisionResolver::default();
        let mut results = Vec::new();
        for item in request.items {
            if cancellation.is_cancelled() {
                return Err(ExportError::Cancelled);
            }
            let relative = resolver.resolve(&safe_relative_path(&item.desired_path)?);
            let output = request.export_root.join(&relative);
            if !output.starts_with(&request.export_root) {
                return Err(ExportError::UnsafePath(item.desired_path));
            }
            if let Some(parent) = output.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&item.source_path, &output)?;
            let actual = sha256(&output)?;
            let verified = item
                .expected_sha256
                .as_ref()
                .is_none_or(|expected| expected == &actual);
            results.push(ExportVerification {
                artifact_id: item.artifact_id,
                output_path: output,
                sha256: actual,
                verified,
            });
        }
        Ok(results)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ExportError {
    #[error("unsafe export path: {0}")]
    UnsafePath(String),
    #[error("export destination is on the source physical device")]
    SamePhysicalDevice,
    #[error("potentially unsafe exports require explicit acknowledgement")]
    UnsafeAcknowledgementRequired,
    #[error("export cancelled")]
    Cancelled,
    #[error("export I/O error: {0}")]
    Io(#[from] std::io::Error),
}
