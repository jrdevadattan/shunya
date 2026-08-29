use crate::{AcquisitionCapability, MemoryAcquisitionAdapter};
pub struct WinPmem;
impl MemoryAcquisitionAdapter for WinPmem {
    fn capability(&self) -> AcquisitionCapability {
        if cfg!(windows) {
            AcquisitionCapability::AvailableWithExplicitElevation
        } else {
            AcquisitionCapability::Unsupported("WinPmem is available only on Windows".into())
        }
    }
    fn tool_id(&self) -> &'static str {
        "winpmem"
    }
}
