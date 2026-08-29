use chrono::{DateTime, Utc};
use recovery_domain::JobStage;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CheckpointStatus {
    Started,
    InProgress,
    Completed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageCheckpoint {
    pub job_id: Uuid,
    pub stage: JobStage,
    pub status: CheckpointStatus,
    pub progress_units: u64,
    pub continuation: Value,
    pub updated_at: DateTime<Utc>,
}
