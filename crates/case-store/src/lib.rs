mod audit;
mod database;
mod paths;

pub use audit::{AuditEvent, AuditEventInput};
pub use paths::{CASE_DIRECTORIES, audit_path, database_path, manifest_path};

use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct CaseInput {
    pub title: String,
    pub operator: String,
    pub reference_number: Option<String>,
    pub organization: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseManifest {
    pub case_id: Uuid,
    pub title: String,
    pub operator: String,
    pub reference_number: Option<String>,
    pub organization: Option<String>,
    pub workspace_path: PathBuf,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailurePoint {
    Never,
    AfterDatabase,
}

#[derive(Debug, Error)]
pub enum CaseStoreError {
    #[error("case title must contain 3 to 120 characters")]
    InvalidTitle,
    #[error("operator is required")]
    MissingOperator,
    #[error("destination already exists and will not be overwritten: {0}")]
    DestinationExists(PathBuf),
    #[error("injected case creation failure")]
    InjectedFailure,
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("manifest error: {0}")]
    Manifest(#[from] serde_json::Error),
}

pub struct CaseStore {
    root: PathBuf,
    connection: Connection,
    manifest: CaseManifest,
}

impl CaseStore {
    pub fn create(root: &Path, input: CaseInput) -> Result<Self, CaseStoreError> {
        Self::create_with_injected_failure(root, input, FailurePoint::Never)
    }

    pub fn create_with_injected_failure(
        root: &Path,
        input: CaseInput,
        failure: FailurePoint,
    ) -> Result<Self, CaseStoreError> {
        validate_input(&input)?;
        if root.exists() {
            return Err(CaseStoreError::DestinationExists(root.to_path_buf()));
        }
        let parent = root.parent().unwrap_or_else(|| Path::new("."));
        fs::create_dir_all(parent)?;
        let staging = parent.join(format!(
            ".{}.creating-{}",
            root.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("case"),
            Uuid::now_v7()
        ));

        let result = Self::create_staged(root, &staging, input, failure);
        if result.is_err() && staging.exists() {
            let _ = fs::remove_dir_all(&staging);
        }
        result
    }

    fn create_staged(
        root: &Path,
        staging: &Path,
        input: CaseInput,
        failure: FailurePoint,
    ) -> Result<Self, CaseStoreError> {
        fs::create_dir(staging)?;
        for directory in CASE_DIRECTORIES {
            fs::create_dir_all(staging.join(directory))?;
        }
        fs::write(staging.join("images/references.json"), b"[]\n")?;

        let manifest = CaseManifest {
            case_id: Uuid::now_v7(),
            title: input.title,
            operator: input.operator,
            reference_number: input.reference_number,
            organization: input.organization,
            workspace_path: root.to_path_buf(),
            notes: input.notes,
            created_at: Utc::now(),
        };

        let connection = database::create(&database_path(staging))?;
        connection.execute(
            "INSERT INTO cases (case_id, title, operator, reference_number, organization, workspace_path, notes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![manifest.case_id.to_string(), manifest.title, manifest.operator, manifest.reference_number, manifest.organization, manifest.workspace_path.to_string_lossy(), manifest.notes, manifest.created_at.to_rfc3339()],
        )?;
        drop(connection);

        if failure == FailurePoint::AfterDatabase {
            return Err(CaseStoreError::InjectedFailure);
        }

        write_manifest_atomic(staging, &manifest)?;
        fs::rename(staging, root)?;
        Self::open(root)
    }

    pub fn open(root: &Path) -> Result<Self, CaseStoreError> {
        let manifest: CaseManifest = serde_json::from_slice(&fs::read(manifest_path(root))?)?;
        let connection = database::open(&database_path(root))?;
        Ok(Self {
            root: root.to_path_buf(),
            connection,
            manifest,
        })
    }

    pub fn manifest(&self) -> &CaseManifest {
        &self.manifest
    }

    pub fn append_event(&mut self, input: AuditEventInput) -> Result<AuditEvent, CaseStoreError> {
        let event = AuditEvent {
            event_id: Uuid::now_v7(),
            case_id: self.manifest.case_id,
            event_type: input.event_type,
            actor: input.actor,
            payload: input.payload,
            created_at: Utc::now(),
        };
        let encoded = serde_json::to_string(&event)?;
        let transaction = self.connection.transaction()?;
        transaction.execute(
            "INSERT INTO audit_events (event_id, case_id, event_type, actor, payload_json, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![event.event_id.to_string(), event.case_id.to_string(), event.event_type, event.actor, event.payload.to_string(), event.created_at.to_rfc3339()],
        )?;
        let mut audit_file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(audit_path(&self.root))?;
        writeln!(audit_file, "{encoded}")?;
        audit_file.sync_all()?;
        transaction.commit()?;
        Ok(event)
    }

    pub fn has_audit_event(&self, event_id: Uuid) -> Result<bool, CaseStoreError> {
        let found = self
            .connection
            .query_row(
                "SELECT event_id FROM audit_events WHERE event_id = ?1",
                [event_id.to_string()],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        Ok(found.is_some())
    }

    pub fn checkpoint(&mut self) -> Result<(), CaseStoreError> {
        self.connection
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
        Ok(())
    }
}

fn validate_input(input: &CaseInput) -> Result<(), CaseStoreError> {
    let title_length = input.title.trim().chars().count();
    if !(3..=120).contains(&title_length) {
        return Err(CaseStoreError::InvalidTitle);
    }
    if input.operator.trim().is_empty() {
        return Err(CaseStoreError::MissingOperator);
    }
    Ok(())
}

fn write_manifest_atomic(root: &Path, manifest: &CaseManifest) -> Result<(), CaseStoreError> {
    let temporary = root.join("case.json.tmp");
    let final_path = manifest_path(root);
    let mut file = fs::File::create(&temporary)?;
    serde_json::to_writer_pretty(&mut file, manifest)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    fs::rename(temporary, final_path)?;
    Ok(())
}
