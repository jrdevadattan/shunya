mod destination;
mod rules;

pub use destination::validate_destination;
pub use rules::assess_source;

use recovery_domain::{CapabilityFinding, EncryptedState, SourceHealth};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Decision {
    Ready,
    Warning,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentResult {
    pub decision: Decision,
    pub requires_acknowledgement: bool,
    pub findings: Vec<CapabilityFinding>,
}

#[derive(Debug, Clone)]
pub struct SourceScenario {
    pub identity_changed: bool,
    pub requires_write: bool,
    pub system_disk: bool,
    pub encrypted_state: EncryptedState,
    pub health: SourceHealth,
    pub experimental_filesystem: bool,
    pub unsupported: bool,
}

impl Default for SourceScenario {
    fn default() -> Self {
        Self {
            identity_changed: false,
            requires_write: false,
            system_disk: false,
            encrypted_state: EncryptedState::None,
            health: SourceHealth::Healthy,
            experimental_filesystem: false,
            unsupported: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct DestinationScenario {
    pub same_physical_device: bool,
    pub writable: bool,
    pub free_bytes: u64,
    pub required_bytes: u64,
    pub network: bool,
    pub removable: bool,
}

impl Default for DestinationScenario {
    fn default() -> Self {
        Self {
            same_physical_device: false,
            writable: true,
            free_bytes: u64::MAX,
            required_bytes: 0,
            network: false,
            removable: false,
        }
    }
}

#[derive(Debug, Default)]
pub struct SafetyPolicy;

impl SafetyPolicy {
    pub fn assess_source(
        &self,
        scenario: SourceScenario,
        preset: recovery_domain::ScanPreset,
        mode: recovery_domain::RuntimeMode,
    ) -> AssessmentResult {
        assess_source(scenario, preset, mode)
    }

    pub fn validate_destination(&self, scenario: DestinationScenario) -> AssessmentResult {
        validate_destination(scenario)
    }
}
