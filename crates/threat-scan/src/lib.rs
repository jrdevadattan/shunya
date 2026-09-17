mod quarantine;
mod yara_x;

pub use quarantine::prepare_quarantine;
pub use yara_x::{CompiledRules, RuleCompileError, ScanError, ThreatOutcome, ThreatRule};

use std::path::Path;

// Built-in demonstration rules. Both are real YARA rules compiled by YARA-X.
// The SIH marker keeps the harmless platform self-test working; the EICAR rule
// detects the standard, industry-safe antivirus test signature so a recovered
// EICAR file is flagged as a potential threat during a demo.
const SIH_TEST_RULE: &str = r#"
rule SIH_Recovery_Platform_Test_2026 {
  strings:
    $marker = "SIH_RECOVERY_TEST_PATTERN_2026"
  condition:
    $marker
}
"#;

const EICAR_RULE: &str = r#"
rule EICAR_Test_File {
  strings:
    $eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
  condition:
    $eicar
}
"#;

fn default_rules() -> Vec<ThreatRule> {
    vec![
        ThreatRule {
            name: "SIH_Recovery_Platform_Test_2026".into(),
            source: SIH_TEST_RULE.into(),
        },
        ThreatRule {
            name: "EICAR_Test_File".into(),
            source: EICAR_RULE.into(),
        },
    ]
}

/// Threat scanner backed by the real YARA-X engine.
pub struct ThreatScanner {
    rules: CompiledRules,
}

impl Default for ThreatScanner {
    fn default() -> Self {
        Self::with_rules(default_rules()).expect("built-in YARA rules compile")
    }
}

impl ThreatScanner {
    pub fn with_rules(rules: Vec<ThreatRule>) -> Result<Self, ThreatScanError> {
        Ok(Self {
            rules: CompiledRules::compile(&rules)?,
        })
    }

    pub fn scan(&self, path: &Path) -> Result<ThreatOutcome, ThreatScanError> {
        let bytes = std::fs::read(path)?;
        Ok(self.rules.scan_bytes(&bytes)?)
    }

    pub fn scan_bytes(&self, bytes: &[u8]) -> Result<ThreatOutcome, ThreatScanError> {
        Ok(self.rules.scan_bytes(bytes)?)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ThreatScanError {
    #[error("threat scan I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Compile(#[from] RuleCompileError),
    #[error(transparent)]
    Scan(#[from] ScanError),
}
