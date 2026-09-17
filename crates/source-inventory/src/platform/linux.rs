use crate::InventoryError;
use recovery_domain::{EncryptedState, SourceDescriptor, SourceHealth, SourceKind};
use std::fs;
use std::path::Path;

pub fn list_physical_sources() -> Result<Vec<SourceDescriptor>, InventoryError> {
    let root = Path::new("/sys/block");
    let mut sources = Vec::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with("loop") || name.starts_with("ram") {
            continue;
        }
        let base = entry.path();
        let sectors = fs::read_to_string(base.join("size"))
            .unwrap_or_default()
            .trim()
            .parse::<u64>()
            .unwrap_or(0);
        let model = fs::read_to_string(base.join("device/model"))
            .ok()
            .map(|value| value.trim().to_owned());
        sources.push(SourceDescriptor {
            source_id: format!("physical-{name}"),
            kind: SourceKind::PhysicalDevice,
            display_name: model.clone().unwrap_or_else(|| name.clone()),
            stable_id: fs::canonicalize(&base)?.display().to_string(),
            size_bytes: sectors.saturating_mul(512),
            logical_sector_size: None,
            physical_sector_size: None,
            bus: None,
            model,
            serial_redacted: None,
            system_disk: false,
            mounted_read_write: false,
            encrypted_state: EncryptedState::Unknown,
            health: SourceHealth::Unknown,
            capabilities: Vec::new(),
        });
    }
    Ok(sources)
}
