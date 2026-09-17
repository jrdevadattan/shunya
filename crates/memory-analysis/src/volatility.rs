use crate::plugin_schema::{NetworkRecord, NormalizedTable, ProcessRecord};
use crate::{MemoryAnalysisError, PluginOutcome};
use serde_json::Value;
use std::path::Path;
use std::time::Duration;
use tool_runner::ToolInvocation;

pub fn invocation(image: &Path, plugin: &str, working_directory: &Path) -> ToolInvocation {
    ToolInvocation {
        tool_id: "volatility3".into(),
        args: vec![
            "-f".into(),
            image.to_string_lossy().into_owned(),
            "-r".into(),
            "json".into(),
            plugin.into(),
        ],
        working_directory: working_directory.into(),
        timeout: Duration::from_secs(2 * 60 * 60),
        environment: Vec::new(),
    }
}

pub fn normalize(
    plugin: &str,
    probable_os: &str,
    value: &Value,
    raw_output: Vec<String>,
) -> Result<PluginOutcome, MemoryAnalysisError> {
    let rows = object_rows(value)?;
    let table = if plugin.contains("pslist") || plugin.contains("cmdline") {
        NormalizedTable::Processes(rows.iter().map(process).collect::<Result<Vec<_>, _>>()?)
    } else if plugin.contains("netscan") || plugin.contains("netstat") {
        NormalizedTable::Network(rows.iter().map(network).collect::<Result<Vec<_>, _>>()?)
    } else {
        NormalizedTable::Generic(rows)
    };
    Ok(PluginOutcome {
        plugin: plugin.into(),
        probable_os: probable_os.into(),
        symbol_identifier: None,
        version: "Volatility 3".into(),
        table: Some(table),
        explanation: None,
        suggested_next_step: None,
        raw_output,
    })
}

pub fn missing_symbols(plugin: &str, probable_os: &str, raw_output: Vec<String>) -> PluginOutcome {
    PluginOutcome { plugin: plugin.into(), probable_os: probable_os.into(), symbol_identifier: None, version: "Volatility 3".into(), table: None, explanation: Some(format!("{plugin} could not run because a matching symbol table or profile was not available for the probable {probable_os} image.")), suggested_next_step: Some("Add the matching Volatility symbol file, verify the image was captured completely, then retry this plugin.".into()), raw_output }
}

fn object_rows(value: &Value) -> Result<Vec<Value>, MemoryAnalysisError> {
    if let Some(array) = value.as_array() {
        return Ok(array.clone());
    }
    let columns = value
        .get("columns")
        .and_then(Value::as_array)
        .ok_or(MemoryAnalysisError::InvalidPluginOutput)?;
    let rows = value
        .get("rows")
        .and_then(Value::as_array)
        .ok_or(MemoryAnalysisError::InvalidPluginOutput)?;
    rows.iter()
        .map(|row| {
            let values = row
                .as_array()
                .ok_or(MemoryAnalysisError::InvalidPluginOutput)?;
            Ok(Value::Object(
                columns
                    .iter()
                    .zip(values)
                    .filter_map(|(column, item)| Some((column.as_str()?.to_owned(), item.clone())))
                    .collect(),
            ))
        })
        .collect()
}

fn process(value: &Value) -> Result<ProcessRecord, MemoryAnalysisError> {
    Ok(ProcessRecord {
        pid: u64_field(value, &["PID", "pid"])?,
        parent_pid: optional_u64(value, &["PPID", "ppid"]),
        image_name: string_field(value, &["ImageFileName", "Name", "image_name"])?,
        command_line: optional_string(value, &["Args", "CommandLine", "command_line"]),
    })
}

fn network(value: &Value) -> Result<NetworkRecord, MemoryAnalysisError> {
    Ok(NetworkRecord {
        protocol: string_field(value, &["Proto", "protocol"])?,
        local_address: string_field(value, &["LocalAddr", "local_address"])?,
        remote_address: optional_string(value, &["ForeignAddr", "remote_address"]),
        state: optional_string(value, &["State", "state"]),
        pid: optional_u64(value, &["PID", "pid"]),
    })
}

fn find<'a>(value: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().find_map(|key| value.get(key))
}
fn u64_field(value: &Value, keys: &[&str]) -> Result<u64, MemoryAnalysisError> {
    optional_u64(value, keys).ok_or(MemoryAnalysisError::InvalidPluginOutput)
}
fn optional_u64(value: &Value, keys: &[&str]) -> Option<u64> {
    find(value, keys).and_then(|item| item.as_u64().or_else(|| item.as_str()?.parse().ok()))
}
fn string_field(value: &Value, keys: &[&str]) -> Result<String, MemoryAnalysisError> {
    optional_string(value, keys).ok_or(MemoryAnalysisError::InvalidPluginOutput)
}
fn optional_string(value: &Value, keys: &[&str]) -> Option<String> {
    find(value, keys).and_then(|item| {
        item.as_str()
            .map(str::to_owned)
            .or_else(|| (!item.is_null()).then(|| item.to_string()))
    })
}
