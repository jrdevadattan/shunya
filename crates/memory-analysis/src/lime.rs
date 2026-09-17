use crate::{AcquisitionCapability, MemoryAcquisitionAdapter};
pub struct Lime;
impl MemoryAcquisitionAdapter for Lime {
    fn capability(&self) -> AcquisitionCapability {
        if cfg!(target_os = "linux") {
            AcquisitionCapability::ExpertOnly("LiME requires a module built for the exact running kernel and may be blocked by kernel lockdown.".into())
        } else {
            AcquisitionCapability::Unsupported("LiME is available only on Linux".into())
        }
    }
    fn tool_id(&self) -> &'static str {
        "lime"
    }
}
