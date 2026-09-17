use crate::{ArtifactQuery, ResultIndexError};
use rusqlite::{Connection, params};

pub fn save(
    connection: &Connection,
    name: &str,
    query: &ArtifactQuery,
) -> Result<(), ResultIndexError> {
    connection.execute("INSERT INTO saved_filters (name, query_json) VALUES (?1, ?2) ON CONFLICT(name) DO UPDATE SET query_json=excluded.query_json", params![name, serde_json::to_string(query)?])?;
    Ok(())
}
