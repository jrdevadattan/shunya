use crate::InventoryError;
use recovery_domain::SourceDescriptor;

pub fn list_physical_sources() -> Result<Vec<SourceDescriptor>, InventoryError> {
    // Disk Arbitration integration is kept behind this platform boundary. The
    // MVP returns no raw paths if the native inventory service is unavailable.
    Ok(Vec::new())
}
