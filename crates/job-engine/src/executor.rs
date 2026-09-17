use crate::{JobEngineError, StageCheckpoint};
use async_trait::async_trait;
use serde_json::Value;

#[async_trait]
pub trait JobStageHandler: Send + Sync {
    async fn execute(&self, checkpoint: Option<&StageCheckpoint>) -> Result<Value, JobEngineError>;
}
