use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AuditEventInput {
    pub event_type: String,
    pub actor: String,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    pub event_id: Uuid,
    pub case_id: Uuid,
    pub event_type: String,
    pub actor: String,
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}
