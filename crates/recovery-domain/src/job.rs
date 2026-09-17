use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryGoal {
    RecentlyDeleted,
    SpecificTarget,
    RecoverEverything,
    PartitionLoss,
    DamagedDevice,
    MemoryAnalysis,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanPreset {
    Quick,
    Full,
    Advanced,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JobStage {
    Draft,
    Preflight,
    WaitingForDestination,
    Acquiring,
    VerifyingImage,
    PartitionScan,
    MetadataScan,
    Carving,
    Validating,
    ThreatScan,
    Indexing,
    ReviewReady,
    Exporting,
    Reporting,
    Completed,
    Paused,
    NeedsAttention,
    Cancelling,
    Cancelled,
    Failed,
}

pub fn can_transition(from: JobStage, to: JobStage) -> bool {
    use JobStage::*;
    matches!(
        (from, to),
        (Draft, Preflight)
            | (Preflight, WaitingForDestination | PartitionScan)
            | (WaitingForDestination, Acquiring)
            | (Acquiring, VerifyingImage)
            | (VerifyingImage, PartitionScan)
            | (PartitionScan, MetadataScan)
            | (MetadataScan, Carving | Validating)
            | (Carving, Validating)
            | (Validating, ThreatScan)
            | (ThreatScan, Indexing)
            | (Indexing, ReviewReady)
            | (ReviewReady, Exporting | Reporting | Completed)
            | (Exporting, ReviewReady | Reporting | Completed)
            | (Reporting, Completed)
            | (
                Paused | NeedsAttention,
                Preflight
                    | Acquiring
                    | PartitionScan
                    | MetadataScan
                    | Carving
                    | Validating
                    | ThreatScan
                    | Indexing
                    | Exporting
                    | Reporting
            )
            | (_, Paused | NeedsAttention | Cancelling | Failed)
            | (Cancelling, Cancelled)
    ) && !matches!(from, Completed | Cancelled | Failed)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryCase {
    pub case_id: String,
    pub title: String,
    pub operator: String,
    pub reference_number: Option<String>,
    pub organization: Option<String>,
    pub workspace_path: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryJob {
    pub job_id: String,
    pub case_id: String,
    pub source_id: String,
    pub goal: RecoveryGoal,
    pub preset: ScanPreset,
    pub stage: JobStage,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEvent {
    pub event_id: String,
    pub job_id: String,
    pub sequence: u64,
    pub stage: JobStage,
    pub occurred_at: String,
    pub message: Option<String>,
}
