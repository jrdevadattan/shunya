mod logs;
mod manifest;
mod process;

pub use manifest::{ToolManifest, ToolManifestEntry, ToolRegistry, current_platform};
pub use process::ToolRunner;

use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, thiserror::Error)]
pub enum ToolRunnerError {
    #[error("tool runner I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("manifest JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid tool manifest: {0}")]
    InvalidManifest(String),
    #[error("unknown or unavailable tool: {0}")]
    UnknownTool(String),
    #[error("tool integrity check failed: {0}")]
    HashMismatch(String),
    #[error("tool output task failed: {0}")]
    Task(String),
}

pub struct ToolInvocation {
    pub tool_id: String,
    pub args: Vec<String>,
    pub working_directory: PathBuf,
    pub timeout: Duration,
    pub environment: Vec<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessStatus {
    Exited(Option<i32>),
    Cancelled,
    TimedOut,
}

#[derive(Debug, Clone)]
pub struct ProcessOutcome {
    pub status: ProcessStatus,
    pub stdout: Vec<String>,
    pub stderr: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum ProcessEvent {
    Started,
    StdoutLine(String),
    StderrLine(String),
    Progress { completed: u64, total: Option<u64> },
    Exited(Option<i32>),
    Cancelled,
    TimedOut,
}
