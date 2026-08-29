mod quarantine;
mod yara_x;

pub use quarantine::prepare_quarantine;
pub use yara_x::{ThreatOutcome, ThreatRule};

use std::path::Path;

pub struct ThreatScanner {
    rules: Vec<ThreatRule>,
}

impl Default for ThreatScanner {
    fn default() -> Self {
        Self {
            rules: vec![ThreatRule {
                name: "SIH_Recovery_Platform_Test_2026".into(),
                pattern: b"SIH_RECOVERY_TEST_PATTERN_2026".to_vec(),
            }],
        }
    }
}

impl ThreatScanner {
    pub fn with_rules(rules: Vec<ThreatRule>) -> Self {
        Self { rules }
    }
    pub fn scan(&self, path: &Path) -> Result<ThreatOutcome, ThreatScanError> {
        Ok(yara_x::scan(path, &self.rules)?)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ThreatScanError {
    #[error("threat scan I/O error: {0}")]
    Io(#[from] std::io::Error),
}
