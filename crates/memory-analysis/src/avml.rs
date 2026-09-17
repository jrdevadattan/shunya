use crate::{AcquisitionCapability, MemoryAcquisitionAdapter};
pub struct Avml;
impl MemoryAcquisitionAdapter for Avml {
    fn capability(&self) -> AcquisitionCapability {
        if cfg!(target_os = "linux") {
            AcquisitionCapability::AvailableWithExplicitElevation
        } else {
            AcquisitionCapability::Unsupported(
                "AVML is available only on supported Linux kernels".into(),
            )
        }
    }
    fn tool_id(&self) -> &'static str {
        "avml"
    }
}
