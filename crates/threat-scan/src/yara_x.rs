use recovery_domain::ThreatStatus;
use serde::{Deserialize, Serialize};
use yara_x::{Compiler, Rules, Scanner};

/// Version of the bundled YARA-X engine. Keep in sync with the `yara-x`
/// dependency in `Cargo.toml`; reported verbatim in [`ThreatOutcome`].
const YARA_X_VERSION: &str = "1.20.0";

/// A named YARA rule source. Each entry is real YARA rule text compiled by the
/// YARA-X engine — not an ad-hoc byte pattern.
#[derive(Debug, Clone)]
pub struct ThreatRule {
    pub name: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreatOutcome {
    pub status: ThreatStatus,
    pub matched_rules: Vec<String>,
    pub scanner_version: String,
}

#[derive(Debug, thiserror::Error)]
pub enum RuleCompileError {
    #[error("failed to compile YARA rule '{name}': {source}")]
    Compile { name: String, source: String },
}

#[derive(Debug, thiserror::Error)]
pub enum ScanError {
    #[error("YARA-X scan failed: {0}")]
    Scan(String),
}

/// Compiled YARA-X rules, ready to scan arbitrary bytes.
pub struct CompiledRules {
    rules: Rules,
}

impl CompiledRules {
    /// Compile the given rule sources with the real YARA-X compiler.
    pub fn compile(rules: &[ThreatRule]) -> Result<Self, RuleCompileError> {
        let mut compiler = Compiler::new();
        for rule in rules {
            compiler
                .add_source(rule.source.as_str())
                .map_err(|error| RuleCompileError::Compile {
                    name: rule.name.clone(),
                    source: error.to_string(),
                })?;
        }
        Ok(Self {
            rules: compiler.build(),
        })
    }

    /// Scan bytes and return the matching rule identifiers reported by YARA-X.
    pub fn scan_bytes(&self, bytes: &[u8]) -> Result<ThreatOutcome, ScanError> {
        let mut scanner = Scanner::new(&self.rules);
        let results = scanner
            .scan(bytes)
            .map_err(|error| ScanError::Scan(error.to_string()))?;
        let matched_rules: Vec<String> = results
            .matching_rules()
            .map(|rule| rule.identifier().to_string())
            .collect();
        Ok(ThreatOutcome {
            status: if matched_rules.is_empty() {
                ThreatStatus::NoRuleMatch
            } else {
                ThreatStatus::PotentialThreat
            },
            matched_rules,
            scanner_version: format!("yara-x/{YARA_X_VERSION}"),
        })
    }
}
