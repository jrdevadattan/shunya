use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryReportManifest {
    pub schema_version: u32,
    pub case_id: String,
    pub source_id: String,
    pub source_geometry: String,
    pub source_hash_before: Option<String>,
    pub source_hash_after: Option<String>,
    pub tools: Vec<ToolRecord>,
    pub method_counts: BTreeMap<String, u64>,
    pub quality_counts: BTreeMap<String, u64>,
    pub warnings: Vec<String>,
    pub unreadable_ranges: Vec<String>,
    pub export_manifest: Vec<ExportRecord>,
    pub limitations: Vec<String>,
    pub signature: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolRecord {
    pub id: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRecord {
    pub artifact_id: String,
    pub relative_path: String,
    pub sha256: String,
    pub verified: bool,
}

impl RecoveryReportManifest {
    pub fn fixture() -> Self {
        let hash = "a".repeat(64);
        Self {
            schema_version: 1,
            case_id: "case-26149".into(),
            source_id: "source-1".into(),
            source_geometry: "512-byte sectors; 1 TiB".into(),
            source_hash_before: Some(hash.clone()),
            source_hash_after: Some(hash),
            tools: vec![ToolRecord {
                id: "tsk-fls".into(),
                version: "4.15.0".into(),
            }],
            method_counts: BTreeMap::from([("metadata".into(), 3), ("carving".into(), 2)]),
            quality_counts: BTreeMap::from([
                ("complete_validated".into(), 4),
                ("partial_unverified".into(), 1),
            ]),
            warnings: vec!["Source health unknown".into()],
            unreadable_ranges: vec!["offset 4096 length 512".into()],
            export_manifest: vec![ExportRecord {
                artifact_id: "a1".into(),
                relative_path: "Finance/report.pdf".into(),
                sha256: "b".repeat(64),
                verified: true,
            }],
            limitations: vec!["Original names are unavailable for carved files.".into()],
            signature: None,
        }
    }
}
