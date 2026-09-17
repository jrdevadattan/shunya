use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProcessRecord {
    pub pid: u64,
    pub parent_pid: Option<u64>,
    pub image_name: String,
    pub command_line: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NetworkRecord {
    pub protocol: String,
    pub local_address: String,
    pub remote_address: Option<String>,
    pub state: Option<String>,
    pub pid: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "rows", rename_all = "snake_case")]
pub enum NormalizedTable {
    Processes(Vec<ProcessRecord>),
    Network(Vec<NetworkRecord>),
    Generic(Vec<serde_json::Value>),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PluginOutcome {
    pub plugin: String,
    pub probable_os: String,
    pub symbol_identifier: Option<String>,
    pub version: String,
    pub table: Option<NormalizedTable>,
    pub explanation: Option<String>,
    pub suggested_next_step: Option<String>,
    pub raw_output: Vec<String>,
}
