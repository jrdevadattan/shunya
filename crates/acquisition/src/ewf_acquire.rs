use std::path::Path;
use std::time::Duration;
use tool_runner::ToolInvocation;

#[derive(Default)]
pub struct EwfAcquisitionAdapter;
impl EwfAcquisitionAdapter {
    pub fn acquire_invocation(
        &self,
        source: &Path,
        output_base: &Path,
        working_directory: &Path,
    ) -> ToolInvocation {
        ToolInvocation {
            tool_id: "ewfacquire".into(),
            args: vec![
                "-t".into(),
                output_base.to_string_lossy().into_owned(),
                "-f".into(),
                "encase6".into(),
                source.to_string_lossy().into_owned(),
            ],
            working_directory: working_directory.into(),
            timeout: Duration::from_secs(24 * 60 * 60),
            environment: Vec::new(),
        }
    }
}
