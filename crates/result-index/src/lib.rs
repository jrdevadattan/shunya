mod pagination;
mod query;
mod saved_filters;

pub use pagination::ArtifactPage;
pub use query::ArtifactQuery;

use rusqlite::{Connection, params, params_from_iter};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactRow {
    pub artifact_id: String,
    pub display_name: String,
    pub original_name: Option<String>,
    pub original_path: Option<String>,
    pub mime_type: Option<String>,
    pub method: String,
    pub status: String,
    pub threat: String,
    pub size_bytes: u64,
    pub partition_id: Option<String>,
}

impl ArtifactRow {
    pub fn fixture(
        id: &str,
        name: &str,
        path: &str,
        method: &str,
        status: &str,
        threat: &str,
        size_bytes: u64,
    ) -> Self {
        Self {
            artifact_id: id.into(),
            display_name: name.into(),
            original_name: Some(name.into()),
            original_path: Some(path.into()),
            mime_type: None,
            method: method.into(),
            status: status.into(),
            threat: threat.into(),
            size_bytes,
            partition_id: None,
        }
    }
}

pub struct ArtifactIndex {
    connection: Connection,
}

impl ArtifactIndex {
    pub fn open(path: &Path) -> Result<Self, ResultIndexError> {
        let connection = Connection::open(path)?;
        connection.execute_batch(
            "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
             CREATE TABLE IF NOT EXISTS artifacts (
               artifact_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, original_name TEXT, original_path TEXT, mime_type TEXT,
               method TEXT NOT NULL, status TEXT NOT NULL, threat TEXT NOT NULL, size_bytes INTEGER NOT NULL,
               partition_id TEXT
             );
             CREATE INDEX IF NOT EXISTS artifacts_filters ON artifacts(method, status, threat, mime_type, partition_id, size_bytes, artifact_id);
             CREATE VIRTUAL TABLE IF NOT EXISTS artifacts_fts USING fts5(artifact_id UNINDEXED, display_name, original_name, original_path, mime_type, tokenize='unicode61');
             CREATE TABLE IF NOT EXISTS saved_filters (name TEXT PRIMARY KEY, query_json TEXT NOT NULL);",
        )?;
        if !table_has_column(&connection, "artifacts", "display_name")? {
            connection.execute(
                "ALTER TABLE artifacts ADD COLUMN display_name TEXT NOT NULL DEFAULT ''",
                [],
            )?;
        }
        if !table_has_column(&connection, "artifacts_fts", "display_name")? {
            connection.execute_batch(
                "DROP TABLE IF EXISTS artifacts_fts;
                 CREATE VIRTUAL TABLE artifacts_fts USING fts5(artifact_id UNINDEXED, display_name, original_name, original_path, mime_type, tokenize='unicode61');
                 INSERT INTO artifacts_fts SELECT artifact_id,display_name,original_name,original_path,mime_type FROM artifacts;",
            )?;
        }
        Ok(Self { connection })
    }

    pub fn insert_batch(&mut self, rows: &[ArtifactRow]) -> Result<(), ResultIndexError> {
        let transaction = self.connection.transaction()?;
        for row in rows {
            transaction.execute(
                "INSERT OR REPLACE INTO artifacts (artifact_id,display_name,original_name,original_path,mime_type,method,status,threat,size_bytes,partition_id) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                params![
                    row.artifact_id,
                    row.display_name,
                    row.original_name,
                    row.original_path,
                    row.mime_type,
                    row.method,
                    row.status,
                    row.threat,
                    row.size_bytes as i64,
                    row.partition_id
                ],
            )?;
            transaction.execute(
                "DELETE FROM artifacts_fts WHERE artifact_id=?1",
                [&row.artifact_id],
            )?;
            transaction.execute(
                "INSERT INTO artifacts_fts VALUES (?1,?2,?3,?4,?5)",
                params![
                    row.artifact_id,
                    row.display_name,
                    row.original_name,
                    row.original_path,
                    row.mime_type
                ],
            )?;
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn query(
        &self,
        query: &ArtifactQuery,
    ) -> Result<ArtifactPage<ArtifactRow>, ResultIndexError> {
        let limit = query.page_size.clamp(1, 500);
        let mut clauses = Vec::new();
        let mut parameters = Vec::new();
        let join = if let Some(search) = &query.search {
            clauses.push("artifacts_fts MATCH ?".into());
            parameters.push(query::fts_expression(search).into());
            " JOIN artifacts_fts ON artifacts_fts.artifact_id=a.artifact_id"
        } else {
            ""
        };
        query::append_filters(query, &mut clauses, &mut parameters, "a");
        parameters.push(((limit + 1) as i64).into());
        let where_clause = if clauses.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", clauses.join(" AND "))
        };
        let sql = format!(
            "SELECT a.artifact_id,a.display_name,a.original_name,a.original_path,a.mime_type,a.method,a.status,a.threat,a.size_bytes,a.partition_id FROM artifacts a{join}{where_clause} ORDER BY a.artifact_id LIMIT ?"
        );
        let mut statement = self.connection.prepare(&sql)?;
        let rows = statement.query_map(params_from_iter(parameters), |row| {
            Ok(ArtifactRow {
                artifact_id: row.get(0)?,
                display_name: row.get(1)?,
                original_name: row.get(2)?,
                original_path: row.get(3)?,
                mime_type: row.get(4)?,
                method: row.get(5)?,
                status: row.get(6)?,
                threat: row.get(7)?,
                size_bytes: row.get::<_, i64>(8)? as u64,
                partition_id: row.get(9)?,
            })
        })?;
        let mut items = rows.collect::<rusqlite::Result<Vec<_>>>()?;
        let next_cursor = if items.len() > limit {
            items.truncate(limit);
            items.last().map(|row| row.artifact_id.clone())
        } else {
            None
        };
        Ok(ArtifactPage { items, next_cursor })
    }

    pub fn count(&self, query: &ArtifactQuery) -> Result<u64, ResultIndexError> {
        let mut copy = query.clone();
        copy.cursor = None;
        let mut clauses = Vec::new();
        let mut parameters = Vec::new();
        let join = if let Some(search) = &copy.search {
            clauses.push("artifacts_fts MATCH ?".into());
            parameters.push(query::fts_expression(search).into());
            " JOIN artifacts_fts ON artifacts_fts.artifact_id=a.artifact_id"
        } else {
            ""
        };
        query::append_filters(&copy, &mut clauses, &mut parameters, "a");
        let where_clause = if clauses.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", clauses.join(" AND "))
        };
        let sql = format!("SELECT COUNT(*) FROM artifacts a{join}{where_clause}");
        Ok(self
            .connection
            .query_row(&sql, params_from_iter(parameters), |row| {
                row.get::<_, i64>(0)
            })? as u64)
    }

    pub fn save_filter(&self, name: &str, query: &ArtifactQuery) -> Result<(), ResultIndexError> {
        saved_filters::save(&self.connection, name, query)
    }

    pub fn seed_generated(&mut self, count: u64) -> Result<(), ResultIndexError> {
        let transaction = self.connection.transaction()?;
        transaction.execute_batch("CREATE TEMP TABLE digits(value INTEGER PRIMARY KEY); INSERT INTO digits VALUES(0),(1),(2),(3),(4),(5),(6),(7),(8),(9);")?;
        let sql = "INSERT INTO artifacts (artifact_id,display_name,original_name,original_path,mime_type,method,status,threat,size_bytes,partition_id)
                   SELECT printf('%07d', n), 'report-'||n||'.pdf', 'report-'||n||'.pdf', '/generated/report-'||n||'.pdf', 'application/pdf',
                          CASE WHEN n%2=0 THEN 'metadata' ELSE 'carving' END, 'complete_validated', 'no_rule_match', n+100, 'p1'
                   FROM (SELECT a.value+b.value*10+c.value*100+d.value*1000+e.value*10000+f.value*100000 AS n FROM digits a,digits b,digits c,digits d,digits e,digits f) WHERE n < ?1";
        transaction.execute(sql, [count as i64])?;
        transaction.execute("INSERT INTO artifacts_fts SELECT artifact_id,display_name,original_name,original_path,mime_type FROM artifacts", [])?;
        transaction.commit()?;
        Ok(())
    }
}

fn table_has_column(
    connection: &Connection,
    table: &str,
    column: &str,
) -> Result<bool, rusqlite::Error> {
    let mut statement = connection.prepare(&format!("PRAGMA table_info({table})"))?;
    let columns = statement.query_map([], |row| row.get::<_, String>(1))?;
    for current in columns {
        if current? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

#[derive(Debug, thiserror::Error)]
pub enum ResultIndexError {
    #[error("result index database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("saved filter JSON error: {0}")]
    Json(#[from] serde_json::Error),
}
