use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryMethod {
    Metadata,
    Carving,
    AllocatedExport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryState {
    CompleteValidated,
    CompleteUnverified,
    PartialValidated,
    PartialUnverified,
    Corrupt,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ThreatStatus {
    NoRuleMatch,
    PotentialThreat,
    ScanError,
    NotScanned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreviewStatus {
    SafePreview,
    Blocked,
    Unsupported,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceRange {
    #[serde(with = "crate::decimal_string")]
    pub offset: u64,
    #[serde(with = "crate::decimal_string")]
    pub length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryArtifact {
    pub artifact_id: String,
    pub source_id: String,
    pub partition_id: Option<String>,
    pub original_name: Option<String>,
    pub original_path: Option<String>,
    pub display_name: String,
    pub extension: Option<String>,
    pub mime_type: Option<String>,
    #[serde(with = "crate::decimal_string")]
    pub size_bytes: u64,
    pub recovery_method: RecoveryMethod,
    pub recovery_state: RecoveryState,
    pub sha256: Option<String>,
    pub source_ranges: Vec<SourceRange>,
    pub threat_status: ThreatStatus,
    pub preview_status: PreviewStatus,
}
