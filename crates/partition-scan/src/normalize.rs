use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionDescriptor {
    pub partition_id: String,
    pub index: u32,
    pub start_sector: u64,
    pub sector_count: u64,
    pub start_offset_bytes: u64,
    pub length_bytes: u64,
    pub partition_type: String,
    pub filesystem: Option<String>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionCandidate {
    pub start_sector: u64,
    pub start_offset_bytes: u64,
    pub filesystem: Option<String>,
    pub confidence: String,
    pub source: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartitionScanResult {
    pub sector_size: u32,
    pub partitions: Vec<PartitionDescriptor>,
    pub candidates: Vec<PartitionCandidate>,
    pub gaps: Vec<(u64, u64)>,
    pub raw_tool_output: Option<String>,
    pub tool_version: Option<String>,
}
