use crate::ToolRunnerError;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolManifest {
    pub manifest_version: u32,
    pub tools: Vec<ToolManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolManifestEntry {
    pub id: String,
    pub version: String,
    pub license: String,
    pub origin: String,
    pub platform: String,
    pub relative_path: PathBuf,
    pub sha256: String,
    pub network_allowed: bool,
    pub redistribution_allowed: bool,
}

pub struct ToolRegistry {
    root: PathBuf,
    entries: BTreeMap<String, ToolManifestEntry>,
    verified: Mutex<BTreeMap<String, String>>,
}

impl ToolRegistry {
    pub fn load(root: &Path, manifest_path: &Path) -> Result<Self, ToolRunnerError> {
        let manifest: ToolManifest = serde_json::from_slice(&fs::read(manifest_path)?)?;
        Self::from_manifest(root, manifest)
    }

    pub fn from_manifest(root: &Path, manifest: ToolManifest) -> Result<Self, ToolRunnerError> {
        if manifest.manifest_version != 1 {
            return Err(ToolRunnerError::InvalidManifest(
                "unsupported manifest version".into(),
            ));
        }
        let mut entries = BTreeMap::new();
        let mut manifest_keys = BTreeSet::new();
        for entry in manifest.tools {
            if entry.id.trim().is_empty()
                || entry.version.trim().is_empty()
                || entry.license.trim().is_empty()
                || entry.origin.trim().is_empty()
            {
                return Err(ToolRunnerError::InvalidManifest(
                    "tool identity, version, license, and origin are required".into(),
                ));
            }
            if entry.network_allowed {
                return Err(ToolRunnerError::InvalidManifest(format!(
                    "network-enabled tool {} is forbidden",
                    entry.id
                )));
            }
            if !entry.redistribution_allowed {
                return Err(ToolRunnerError::InvalidManifest(format!(
                    "tool {} is not approved for redistribution",
                    entry.id
                )));
            }
            if !supported_platform(&entry.platform) {
                return Err(ToolRunnerError::InvalidManifest(format!(
                    "unsupported platform for {}: {}",
                    entry.id, entry.platform
                )));
            }
            if entry.sha256.len() != 64
                || !entry
                    .sha256
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
            {
                return Err(ToolRunnerError::InvalidManifest(format!(
                    "invalid SHA-256 for {}",
                    entry.id
                )));
            }
            if !entry
                .relative_path
                .to_str()
                .is_some_and(is_portable_tool_relative_path)
            {
                return Err(ToolRunnerError::InvalidManifest(format!(
                    "unsafe path for {}",
                    entry.id
                )));
            }
            if !manifest_keys.insert((entry.id.clone(), entry.platform.clone())) {
                return Err(ToolRunnerError::InvalidManifest(
                    "duplicate tool ID and platform".into(),
                ));
            }
            if entry.platform != current_platform() {
                continue;
            }
            if entries.insert(entry.id.clone(), entry).is_some() {
                return Err(ToolRunnerError::InvalidManifest("duplicate tool ID".into()));
            }
        }
        Ok(Self {
            root: root.to_path_buf(),
            entries,
            verified: Mutex::new(BTreeMap::new()),
        })
    }

    pub fn load_and_verify(&self, id: &str) -> Result<PathBuf, ToolRunnerError> {
        let entry = self
            .entries
            .get(id)
            .ok_or_else(|| ToolRunnerError::UnknownTool(id.into()))?;
        let path = self.root.join(&entry.relative_path);
        let bytes = fs::read(&path)?;
        let actual: String = Sha256::digest(bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        if actual != entry.sha256 {
            return Err(ToolRunnerError::HashMismatch(id.into()));
        }
        self.verified
            .lock()
            .expect("verification cache")
            .insert(id.into(), actual);
        Ok(path)
    }

    pub fn entry(&self, id: &str) -> Option<&ToolManifestEntry> {
        self.entries.get(id)
    }
}

fn supported_platform(platform: &str) -> bool {
    matches!(
        platform,
        "windows-x64" | "linux-x64" | "linux-arm64" | "macos-x64" | "macos-arm64"
    )
}

pub fn is_portable_tool_relative_path(value: &str) -> bool {
    if value.is_empty() || value.starts_with('/') || value.contains('\\') {
        return false;
    }
    value.split('/').all(|component| {
        !component.is_empty()
            && component != "."
            && component != ".."
            && !component.ends_with(['.', ' '])
            && !component.chars().any(|character| {
                is_portable_control(character)
                    || matches!(character, '<' | '>' | ':' | '"' | '|' | '?' | '*')
            })
            && !windows_reserved_component(component)
    })
}

fn windows_reserved_component(component: &str) -> bool {
    let stem = component.split('.').next().unwrap_or_default();
    let upper = stem.to_ascii_uppercase();
    matches!(
        upper.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CLOCK$" | "CONIN$" | "CONOUT$"
    ) || upper
        .strip_prefix("COM")
        .or_else(|| upper.strip_prefix("LPT"))
        .is_some_and(|suffix| {
            matches!(suffix, "¹" | "²" | "³")
                || (suffix.len() == 1 && matches!(suffix.as_bytes()[0], b'1'..=b'9'))
        })
}

fn is_portable_control(character: char) -> bool {
    matches!(character as u32, 0x0000..=0x001f | 0x007f..=0x009f)
}

pub fn current_platform() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => "windows-x64",
        ("linux", "x86_64") => "linux-x64",
        ("linux", "aarch64") => "linux-arm64",
        ("macos", "x86_64") => "macos-x64",
        ("macos", "aarch64") => "macos-arm64",
        _ => "unsupported",
    }
}
