use recovery_domain::ThreatStatus;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ThreatRule {
    pub name: String,
    pub pattern: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThreatOutcome {
    pub status: ThreatStatus,
    pub matched_rules: Vec<String>,
    pub scanner_version: String,
}

pub fn scan(path: &Path, rules: &[ThreatRule]) -> std::io::Result<ThreatOutcome> {
    let bytes = fs::read(path)?;
    let matched_rules = rules
        .iter()
        .filter(|rule| {
            !rule.pattern.is_empty()
                && bytes
                    .windows(rule.pattern.len())
                    .any(|window| window == rule.pattern)
        })
        .map(|rule| rule.name.clone())
        .collect::<Vec<_>>();
    Ok(ThreatOutcome {
        status: if matched_rules.is_empty() {
            ThreatStatus::NoRuleMatch
        } else {
            ThreatStatus::PotentialThreat
        },
        matched_rules,
        scanner_version: "yara-x-adapter/1".into(),
    })
}
