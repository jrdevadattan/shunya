mod avml;
mod lime;
mod plugin_schema;
mod volatility;
mod winpem;

pub use avml::Avml;
pub use lime::Lime;
pub use plugin_schema::{NetworkRecord, NormalizedTable, PluginOutcome, ProcessRecord};
pub use winpem::WinPmem;

use serde_json::Value;
use std::path::Path;
use tool_runner::ToolInvocation;

#[derive(Default)]
pub struct MemoryAnalyzer;
impl MemoryAnalyzer {
    pub fn detect(&self, banner: &str) -> String {
        let lower = banner.to_ascii_lowercase();
        if lower.contains("windows") {
            "Windows".into()
        } else if lower.contains("linux") {
            "Linux".into()
        } else if lower.contains("darwin") || lower.contains("mac") {
            "macOS".into()
        } else {
            "Unknown OS".into()
        }
    }
    pub fn run_plugin(
        &self,
        image: &Path,
        plugin: &str,
        working_directory: &Path,
    ) -> ToolInvocation {
        volatility::invocation(image, plugin, working_directory)
    }
    pub fn normalize_plugin(
        &self,
        plugin: &str,
        probable_os: &str,
        value: &Value,
        raw_output: Vec<String>,
    ) -> Result<PluginOutcome, MemoryAnalysisError> {
        volatility::normalize(plugin, probable_os, value, raw_output)
    }
    pub fn missing_symbols(
        &self,
        plugin: &str,
        probable_os: &str,
        raw_output: Vec<String>,
    ) -> PluginOutcome {
        volatility::missing_symbols(plugin, probable_os, raw_output)
    }
    pub fn run_preset(
        &self,
        image: &Path,
        probable_os: &str,
        working_directory: &Path,
    ) -> Vec<ToolInvocation> {
        let plugins: &[&str] = if probable_os.eq_ignore_ascii_case("windows") {
            &[
                "windows.pslist.PsList",
                "windows.cmdline.CmdLine",
                "windows.netscan.NetScan",
                "windows.modules.Modules",
                "yarascan.YaraScan",
            ]
        } else {
            &[
                "linux.pslist.PsList",
                "linux.bash.Bash",
                "linux.sockstat.Sockstat",
                "linux.lsmod.Lsmod",
                "yarascan.YaraScan",
            ]
        };
        plugins
            .iter()
            .map(|plugin| self.run_plugin(image, plugin, working_directory))
            .collect()
    }
}

pub trait MemoryAcquisitionAdapter {
    fn capability(&self) -> AcquisitionCapability;
    fn tool_id(&self) -> &'static str;
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AcquisitionCapability {
    AvailableWithExplicitElevation,
    ExpertOnly(String),
    Unsupported(String),
}

#[derive(Debug, thiserror::Error)]
pub enum MemoryAnalysisError {
    #[error("Volatility returned an unsupported JSON schema")]
    InvalidPluginOutput,
}
