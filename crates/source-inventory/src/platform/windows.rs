use crate::InventoryError;
use recovery_domain::{EncryptedState, SourceDescriptor, SourceHealth, SourceKind};
use serde::Deserialize;
use std::process::Command;

#[derive(Deserialize)]
#[serde(rename_all = "PascalCase")]
struct DiskRecord {
    friendly_name: Option<String>,
    unique_id: Option<String>,
    serial_number: Option<String>,
    size: Option<u64>,
    bus_type: Option<String>,
    is_boot: Option<bool>,
    is_system: Option<bool>,
}

pub fn list_physical_sources() -> Result<Vec<SourceDescriptor>, InventoryError> {
    let script = "Get-Disk | Select-Object FriendlyName,UniqueId,SerialNumber,Size,BusType,IsBoot,IsSystem | ConvertTo-Json -Compress";
    let output = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script,
        ])
        .output()?;
    if !output.status.success() {
        return Err(InventoryError::Platform(
            String::from_utf8_lossy(&output.stderr).into_owned(),
        ));
    }
    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|error| InventoryError::Platform(error.to_string()))?;
    let records: Vec<DiskRecord> = if value.is_array() {
        serde_json::from_value(value)
            .map_err(|error| InventoryError::Platform(error.to_string()))?
    } else if value.is_null() {
        Vec::new()
    } else {
        vec![
            serde_json::from_value(value)
                .map_err(|error| InventoryError::Platform(error.to_string()))?,
        ]
    };
    Ok(records
        .into_iter()
        .enumerate()
        .map(|(index, disk)| {
            let stable = disk
                .unique_id
                .filter(|id| !id.trim().is_empty())
                .unwrap_or_else(|| format!("windows-disk-{index}"));
            SourceDescriptor {
                source_id: format!("physical-{index}"),
                kind: SourceKind::PhysicalDevice,
                display_name: disk
                    .friendly_name
                    .unwrap_or_else(|| format!("Physical disk {}", index + 1)),
                stable_id: stable,
                size_bytes: disk.size.unwrap_or(0),
                logical_sector_size: None,
                physical_sector_size: None,
                bus: disk.bus_type,
                model: None,
                serial_redacted: disk.serial_number.map(|serial| redact(&serial)),
                system_disk: disk.is_boot.unwrap_or(false) || disk.is_system.unwrap_or(false),
                mounted_read_write: false,
                encrypted_state: EncryptedState::Unknown,
                health: SourceHealth::Unknown,
                capabilities: Vec::new(),
            }
        })
        .collect())
}

fn redact(value: &str) -> String {
    let suffix: String = value
        .chars()
        .rev()
        .take(4)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    format!("••••{suffix}")
}
