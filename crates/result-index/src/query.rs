use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactQuery {
    pub search: Option<String>,
    pub original_path_prefix: Option<String>,
    pub method: Option<String>,
    pub status: Option<String>,
    pub threat: Option<String>,
    pub mime_type: Option<String>,
    /// Restrict to artifacts whose detected MIME type is one of these values.
    #[serde(default)]
    pub mime_types: Option<Vec<String>>,
    /// Restrict to artifacts whose MIME type is unknown or outside this list.
    #[serde(default)]
    pub exclude_mime_types: Option<Vec<String>>,
    pub partition_id: Option<String>,
    pub min_size: Option<u64>,
    pub max_size: Option<u64>,
    pub cursor: Option<String>,
    pub page_size: usize,
}

pub(crate) fn append_filters(
    query: &ArtifactQuery,
    clauses: &mut Vec<String>,
    parameters: &mut Vec<rusqlite::types::Value>,
    table: &str,
) {
    for (column, value) in [
        ("method", &query.method),
        ("status", &query.status),
        ("threat", &query.threat),
        ("mime_type", &query.mime_type),
        ("partition_id", &query.partition_id),
    ] {
        if let Some(value) = value {
            clauses.push(format!("{table}.{column} = ?"));
            parameters.push(value.clone().into());
        }
    }
    if let Some(mime_types) = query.mime_types.as_ref().filter(|list| !list.is_empty()) {
        let placeholders = vec!["?"; mime_types.len()].join(",");
        clauses.push(format!("{table}.mime_type IN ({placeholders})"));
        parameters.extend(mime_types.iter().cloned().map(Into::into));
    }
    if let Some(excluded) = query
        .exclude_mime_types
        .as_ref()
        .filter(|list| !list.is_empty())
    {
        let placeholders = vec!["?"; excluded.len()].join(",");
        clauses.push(format!(
            "({table}.mime_type IS NULL OR {table}.mime_type NOT IN ({placeholders}))"
        ));
        parameters.extend(excluded.iter().cloned().map(Into::into));
    }
    if let Some(minimum) = query.min_size {
        clauses.push(format!("{table}.size_bytes >= ?"));
        parameters.push((minimum as i64).into());
    }
    if let Some(maximum) = query.max_size {
        clauses.push(format!("{table}.size_bytes <= ?"));
        parameters.push((maximum as i64).into());
    }
    if let Some(prefix) = query
        .original_path_prefix
        .as_deref()
        .map(normalize_path_prefix)
        .filter(|prefix| !prefix.is_empty())
    {
        let normalized_path = format!("ltrim(replace({table}.original_path, char(92), '/'), '/')");
        clauses.push(format!(
            "{table}.method = 'metadata' AND {table}.original_path IS NOT NULL AND substr({normalized_path}, 1, length(?)) = ? COLLATE NOCASE AND substr({normalized_path}, length(?) + 1, 1) = '/'"
        ));
        parameters.push(prefix.clone().into());
        parameters.push(prefix.clone().into());
        parameters.push(prefix.into());
    }
    if let Some(cursor) = &query.cursor {
        clauses.push(format!("{table}.artifact_id > ?"));
        parameters.push(cursor.clone().into());
    }
}

fn normalize_path_prefix(prefix: &str) -> String {
    prefix
        .replace('\\', "/")
        .split('/')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

pub(crate) fn fts_expression(search: &str) -> String {
    format!("\"{}\"", search.replace('"', "\"\""))
}
