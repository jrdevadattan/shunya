mod checkpoint;
mod executor;
mod state_machine;

pub use checkpoint::{CheckpointStatus, StageCheckpoint};
pub use executor::JobStageHandler;
pub use state_machine::{JobStage, can_transition, next_stage};

use chrono::{DateTime, Utc};
use recovery_domain::{RecoveryGoal, ScanPreset};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::Path;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum JobEngineError {
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("invalid persisted JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("job not found: {0}")]
    NotFound(Uuid),
    #[error("invalid job transition from {from:?} to {to:?}")]
    InvalidTransition { from: JobStage, to: JobStage },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSnapshot {
    pub job_id: Uuid,
    pub case_id: Uuid,
    pub source_id: String,
    pub goal: RecoveryGoal,
    pub preset: ScanPreset,
    pub stage: JobStage,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoverableState {
    PausedRecoverable,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecoveredJob {
    pub job_id: Uuid,
    pub state: RecoverableState,
    pub resume_stage: JobStage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobEvent {
    pub event_id: Uuid,
    pub job_id: Uuid,
    pub sequence: u64,
    pub stage: JobStage,
    pub occurred_at: DateTime<Utc>,
    pub message: Option<String>,
}

pub struct JobEngine {
    connection: Connection,
}

impl JobEngine {
    pub fn open(case_root: &Path) -> Result<Self, JobEngineError> {
        let connection = Connection::open(case_root.join("case.sqlite"))?;
        connection.execute_batch(
            "PRAGMA journal_mode=WAL;
             PRAGMA synchronous=FULL;
             PRAGMA foreign_keys=ON;
             CREATE TABLE IF NOT EXISTS job_events (
               event_id TEXT PRIMARY KEY,
               job_id TEXT NOT NULL REFERENCES jobs(job_id),
               sequence INTEGER NOT NULL,
               stage TEXT NOT NULL,
               occurred_at TEXT NOT NULL,
               message TEXT,
               UNIQUE(job_id, sequence)
             );",
        )?;
        Ok(Self { connection })
    }

    pub fn create_job(
        &mut self,
        case_id: Uuid,
        source_id: &str,
        goal: RecoveryGoal,
        preset: ScanPreset,
    ) -> Result<JobSnapshot, JobEngineError> {
        let now = Utc::now();
        let job = JobSnapshot {
            job_id: Uuid::now_v7(),
            case_id,
            source_id: source_id.into(),
            goal,
            preset,
            stage: JobStage::Draft,
            created_at: now,
            updated_at: now,
        };
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT OR IGNORE INTO sources (source_id, case_id, descriptor_json, created_at) VALUES (?1, ?2, '{}', ?3)",
            params![source_id, case_id.to_string(), now.to_rfc3339()],
        )?;
        transaction.execute(
            "INSERT INTO jobs (job_id, case_id, source_id, stage, state_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![job.job_id.to_string(), case_id.to_string(), source_id, encode(&job.stage)?, json!({"goal": goal, "preset": preset}).to_string(), now.to_rfc3339(), now.to_rfc3339()],
        )?;
        transaction.commit()?;
        self.append_event(job.job_id, job.stage, Some("Recovery job created".into()))?;
        Ok(job)
    }

    pub fn start(&mut self, job_id: Uuid) -> Result<JobSnapshot, JobEngineError> {
        self.transition(job_id, JobStage::Preflight, "Recovery job started")
    }

    pub fn pause(&mut self, job_id: Uuid) -> Result<JobSnapshot, JobEngineError> {
        let current = self.snapshot(job_id)?;
        self.set_resume_stage(job_id, current.stage)?;
        self.transition(job_id, JobStage::Paused, "Recovery job paused")
    }

    pub fn resume(&mut self, job_id: Uuid) -> Result<JobSnapshot, JobEngineError> {
        let resume_stage = self.resume_stage(job_id)?;
        self.transition(job_id, resume_stage, "Recovery job resumed")
    }

    pub fn needs_attention(
        &mut self,
        job_id: Uuid,
        resume_stage: JobStage,
        message: &str,
    ) -> Result<JobSnapshot, JobEngineError> {
        self.set_resume_stage(job_id, resume_stage)?;
        self.transition(job_id, JobStage::NeedsAttention, message)
    }

    pub fn cancel(&mut self, job_id: Uuid) -> Result<JobSnapshot, JobEngineError> {
        self.transition(job_id, JobStage::Cancelling, "Cancellation requested")?;
        self.transition(job_id, JobStage::Cancelled, "Recovery job cancelled")
    }

    pub fn checkpoint(
        &mut self,
        job_id: Uuid,
        stage: JobStage,
        status: CheckpointStatus,
        progress_units: u64,
        continuation: Value,
    ) -> Result<StageCheckpoint, JobEngineError> {
        self.snapshot(job_id)?;
        let checkpoint = StageCheckpoint {
            job_id,
            stage,
            status,
            progress_units,
            continuation,
            updated_at: Utc::now(),
        };
        self.connection.execute(
            "INSERT INTO job_checkpoints (job_id, stage, status, progress_units, continuation_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(job_id, stage) DO UPDATE SET status=excluded.status, progress_units=excluded.progress_units, continuation_json=excluded.continuation_json, updated_at=excluded.updated_at",
            params![job_id.to_string(), encode(&stage)?, encode(&status)?, progress_units.to_string(), checkpoint.continuation.to_string(), checkpoint.updated_at.to_rfc3339()],
        )?;
        self.connection.execute(
            "UPDATE jobs SET stage=?1, updated_at=?2 WHERE job_id=?3",
            params![
                encode(&stage)?,
                checkpoint.updated_at.to_rfc3339(),
                job_id.to_string()
            ],
        )?;
        self.append_event(job_id, stage, Some(format!("Checkpoint {status:?}")))?;
        Ok(checkpoint)
    }

    pub fn checkpoint_for(
        &self,
        job_id: Uuid,
        stage: JobStage,
    ) -> Result<Option<StageCheckpoint>, JobEngineError> {
        self.connection
            .query_row(
                "SELECT status, progress_units, continuation_json, updated_at FROM job_checkpoints WHERE job_id=?1 AND stage=?2",
                params![job_id.to_string(), encode(&stage)?],
                |row| {
                    let status: String = row.get(0)?;
                    let progress: String = row.get(1)?;
                    let continuation: String = row.get(2)?;
                    let updated: String = row.get(3)?;
                    Ok((status, progress, continuation, updated))
                },
            )
            .optional()?
            .map(|(status, progress, continuation, updated)| {
                Ok(StageCheckpoint {
                    job_id,
                    stage,
                    status: decode(&status)?,
                    progress_units: progress.parse().unwrap_or(0),
                    continuation: serde_json::from_str(&continuation)?,
                    updated_at: DateTime::parse_from_rfc3339(&updated).unwrap().with_timezone(&Utc),
                })
            })
            .transpose()
    }

    pub fn recover_incomplete_jobs(&mut self) -> Result<Vec<RecoveredJob>, JobEngineError> {
        let candidates = {
            let mut statement = self.connection.prepare(
                "SELECT j.job_id, c.stage FROM jobs j JOIN job_checkpoints c ON c.job_id=j.job_id
                 WHERE c.status IN ('started', 'in_progress')
                   AND j.stage NOT IN ('paused', 'needs_attention', 'completed', 'cancelled', 'failed')
                 ORDER BY c.updated_at DESC",
            )?;
            let rows = statement.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        };
        let mut recovered = Vec::new();
        for (job, stage) in candidates {
            let job_id = Uuid::parse_str(&job).expect("persisted job UUID");
            let resume_stage: JobStage = decode(&stage)?;
            if recovered
                .iter()
                .any(|item: &RecoveredJob| item.job_id == job_id)
            {
                continue;
            }
            self.set_resume_stage(job_id, resume_stage)?;
            self.connection.execute(
                "UPDATE jobs SET stage='paused', updated_at=?1 WHERE job_id=?2",
                params![Utc::now().to_rfc3339(), job],
            )?;
            recovered.push(RecoveredJob {
                job_id,
                state: RecoverableState::PausedRecoverable,
                resume_stage,
            });
        }
        Ok(recovered)
    }

    pub fn snapshot(&self, job_id: Uuid) -> Result<JobSnapshot, JobEngineError> {
        let row = self.connection.query_row(
            "SELECT case_id, source_id, stage, state_json, created_at, updated_at FROM jobs WHERE job_id=?1",
            [job_id.to_string()],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?, row.get::<_, String>(4)?, row.get::<_, String>(5)?)),
        ).optional()?.ok_or(JobEngineError::NotFound(job_id))?;
        let state: Value = serde_json::from_str(&row.3)?;
        Ok(JobSnapshot {
            job_id,
            case_id: Uuid::parse_str(&row.0).expect("persisted case UUID"),
            source_id: row.1,
            goal: serde_json::from_value(
                state
                    .get("goal")
                    .cloned()
                    .unwrap_or(json!("recover_everything")),
            )?,
            preset: serde_json::from_value(state.get("preset").cloned().unwrap_or(json!("full")))?,
            stage: decode(&row.2)?,
            created_at: DateTime::parse_from_rfc3339(&row.4)
                .unwrap()
                .with_timezone(&Utc),
            updated_at: DateTime::parse_from_rfc3339(&row.5)
                .unwrap()
                .with_timezone(&Utc),
        })
    }

    pub fn events_after(
        &self,
        job_id: Uuid,
        sequence: u64,
    ) -> Result<Vec<JobEvent>, JobEngineError> {
        let mut statement = self.connection.prepare(
            "SELECT event_id, sequence, stage, occurred_at, message FROM job_events WHERE job_id=?1 AND sequence>?2 ORDER BY sequence",
        )?;
        let rows = statement.query_map(params![job_id.to_string(), sequence], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, u64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })?;
        rows.map(|row| {
            let (event_id, sequence, stage, occurred_at, message) = row?;
            Ok(JobEvent {
                event_id: Uuid::parse_str(&event_id).unwrap(),
                job_id,
                sequence,
                stage: decode(&stage)?,
                occurred_at: DateTime::parse_from_rfc3339(&occurred_at)
                    .unwrap()
                    .with_timezone(&Utc),
                message,
            })
        })
        .collect()
    }

    fn transition(
        &mut self,
        job_id: Uuid,
        to: JobStage,
        message: &str,
    ) -> Result<JobSnapshot, JobEngineError> {
        let current = self.snapshot(job_id)?;
        if !can_transition(current.stage, to) {
            return Err(JobEngineError::InvalidTransition {
                from: current.stage,
                to,
            });
        }
        self.connection.execute(
            "UPDATE jobs SET stage=?1, updated_at=?2 WHERE job_id=?3",
            params![encode(&to)?, Utc::now().to_rfc3339(), job_id.to_string()],
        )?;
        self.append_event(job_id, to, Some(message.into()))?;
        self.snapshot(job_id)
    }

    fn append_event(
        &mut self,
        job_id: Uuid,
        stage: JobStage,
        message: Option<String>,
    ) -> Result<JobEvent, JobEngineError> {
        let sequence: u64 = self.connection.query_row(
            "SELECT COALESCE(MAX(sequence), 0) + 1 FROM job_events WHERE job_id=?1",
            [job_id.to_string()],
            |row| row.get(0),
        )?;
        let event = JobEvent {
            event_id: Uuid::now_v7(),
            job_id,
            sequence,
            stage,
            occurred_at: Utc::now(),
            message,
        };
        self.connection.execute(
            "INSERT INTO job_events (event_id, job_id, sequence, stage, occurred_at, message) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![event.event_id.to_string(), job_id.to_string(), sequence, encode(&stage)?, event.occurred_at.to_rfc3339(), event.message],
        )?;
        Ok(event)
    }

    fn set_resume_stage(&mut self, job_id: Uuid, stage: JobStage) -> Result<(), JobEngineError> {
        let mut state: Value = self
            .connection
            .query_row(
                "SELECT state_json FROM jobs WHERE job_id=?1",
                [job_id.to_string()],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .map(|value| serde_json::from_str(&value))
            .transpose()?
            .ok_or(JobEngineError::NotFound(job_id))?;
        state["resumeStage"] = serde_json::to_value(stage)?;
        self.connection.execute(
            "UPDATE jobs SET state_json=?1 WHERE job_id=?2",
            params![state.to_string(), job_id.to_string()],
        )?;
        Ok(())
    }

    fn resume_stage(&self, job_id: Uuid) -> Result<JobStage, JobEngineError> {
        let state: String = self
            .connection
            .query_row(
                "SELECT state_json FROM jobs WHERE job_id=?1",
                [job_id.to_string()],
                |row| row.get(0),
            )
            .optional()?
            .ok_or(JobEngineError::NotFound(job_id))?;
        let state: Value = serde_json::from_str(&state)?;
        Ok(serde_json::from_value(state["resumeStage"].clone())?)
    }
}

fn encode<T: Serialize>(value: &T) -> Result<String, serde_json::Error> {
    serde_json::to_string(value).map(|value| value.trim_matches('"').to_owned())
}

fn decode<T: for<'de> Deserialize<'de>>(value: &str) -> Result<T, serde_json::Error> {
    serde_json::from_str(&format!("\"{value}\""))
}
