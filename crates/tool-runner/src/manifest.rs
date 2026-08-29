use crate::ToolRunnerError;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
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
    pub platform: String,
    pub relative_path: PathBuf,
    pub sha256: String,
    pub network_allowed: bool,
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
        for entry in manifest.tools {
            if entry.platform != current_platform() {
                continue;
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
            if entry.relative_path.is_absolute()
                || entry.relative_path.components().any(|component| {
                    matches!(
                        component,
                        Component::ParentDir | Component::RootDir | Component::Prefix(_)
                    )
                })
            {
                return Err(ToolRunnerError::InvalidManifest(format!(
                    "unsafe path for {}",
                    entry.id
                )));
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
