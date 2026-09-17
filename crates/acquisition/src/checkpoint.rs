use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcquisitionCheckpoint {
    pub stable_id: String,
    pub total_bytes: u64,
    pub completed_chunks: BTreeMap<u64, String>,
    pub unreadable_ranges: Vec<UnreadableRange>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UnreadableRange {
    pub offset: u64,
    pub length: u64,
}

impl AcquisitionCheckpoint {
    pub fn load(path: &Path) -> std::io::Result<Option<Self>> {
        if !path.exists() {
            return Ok(None);
        }
        serde_json::from_slice(&fs::read(path)?)
            .map(Some)
            .map_err(std::io::Error::other)
    }

    pub fn save(&self, path: &Path) -> std::io::Result<()> {
        let pending = path.with_extension("checkpoint.pending");
        fs::write(
            &pending,
            serde_json::to_vec_pretty(self).map_err(std::io::Error::other)?,
        )?;
        fs::rename(pending, path)
    }
}
