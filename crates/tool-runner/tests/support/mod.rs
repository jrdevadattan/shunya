use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tempfile::TempDir;
use tool_runner::{ToolManifest, ToolManifestEntry, ToolRegistry};

#[allow(dead_code)]
pub struct FixtureRegistry {
    pub root: TempDir,
    pub executable: PathBuf,
    pub registry: ToolRegistry,
}

pub fn fixture_registry() -> FixtureRegistry {
    let source = PathBuf::from(env!("CARGO_BIN_EXE_tool-runner-fixture"));
    let root = TempDir::new().unwrap();
    let executable = root.path().join(source.file_name().unwrap());
    std::fs::copy(&source, &executable).unwrap();
    let hash = Sha256::digest(std::fs::read(&executable).unwrap());
    let registry = ToolRegistry::from_manifest(
        root.path(),
        ToolManifest {
            manifest_version: 1,
            tools: vec![ToolManifestEntry {
                id: "fixture".into(),
                version: "test".into(),
                license: "test-only".into(),
                origin: "test-fixture".into(),
                platform: tool_runner::current_platform().into(),
                relative_path: executable.file_name().unwrap().into(),
                sha256: hash.iter().map(|byte| format!("{byte:02x}")).collect(),
                network_allowed: false,
                redistribution_allowed: true,
            }],
        },
    )
    .unwrap();
    FixtureRegistry {
        root,
        executable,
        registry,
    }
}
