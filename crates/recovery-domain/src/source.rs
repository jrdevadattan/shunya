use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeMode {
    Installed,
    Rescue,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    PhysicalDevice,
    RawImage,
    EwfImage,
    MemoryImage,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityLevel {
    Supported,
    Limited,
    Unsupported,
    RequiresRescueMode,
    RequiresElevation,
    RequiresUnlock,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityFinding {
    pub code: String,
    pub level: CapabilityLevel,
    pub title: String,
    pub explanation: String,
    pub recommended_action: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EncryptedState {
    None,
    Locked,
    Unlocked,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceHealth {
    Healthy,
    Warning,
    Failing,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDescriptor {
    pub source_id: String,
    pub kind: SourceKind,
    pub display_name: String,
    pub stable_id: String,
    #[serde(with = "crate::decimal_string")]
    pub size_bytes: u64,
    pub logical_sector_size: Option<u32>,
    pub physical_sector_size: Option<u32>,
    pub bus: Option<String>,
    pub model: Option<String>,
    pub serial_redacted: Option<String>,
    pub system_disk: bool,
    pub mounted_read_write: bool,
    pub encrypted_state: EncryptedState,
    pub health: SourceHealth,
    pub capabilities: Vec<CapabilityFinding>,
}
