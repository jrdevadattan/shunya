use crate::CarvingError;
use recovery_domain::{
    PreviewStatus, RecoveryArtifact, RecoveryMethod, RecoveryState, ThreatStatus,
};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use uuid::Uuid;

pub fn normalize_carved_file(
    source_id: &str,
    path: &Path,
    signature_family: &str,
) -> Result<RecoveryArtifact, CarvingError> {
    let bytes = fs::read(path)?;
    let generated = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("recovered");
    let sequence = generated.trim_start_matches(|character: char| !character.is_ascii_digit());
    let family = signature_family.to_ascii_uppercase();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase);
    Ok(RecoveryArtifact {
        artifact_id: Uuid::now_v7().to_string(),
        source_id: source_id.into(),
        partition_id: None,
        original_name: None,
        original_path: None,
        display_name: format!("Recovered {family} {sequence}"),
        extension,
        mime_type: None,
        size_bytes: bytes.len() as u64,
        recovery_method: RecoveryMethod::Carving,
        recovery_state: RecoveryState::CompleteUnverified,
        sha256: Some(
            Sha256::digest(bytes)
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect(),
        ),
        source_ranges: Vec::new(),
        threat_status: ThreatStatus::NotScanned,
        preview_status: PreviewStatus::Unsupported,
    })
}
