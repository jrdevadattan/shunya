use crate::{ToolManifest, ToolManifestEntry};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

const VERSION_OUTPUT_LIMIT: u64 = 64 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeToolCandidate {
    pub id: String,
    pub version: String,
    pub license: String,
    pub origin: String,
    pub platform: String,
    pub relative_path: PathBuf,
    pub expected_sha256: String,
    pub version_arguments: Vec<String>,
    pub network_allowed: bool,
    pub redistribution_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCandidateCatalog {
    pub schema_version: u32,
    pub candidates: Vec<NativeToolCandidate>,
}

pub struct ToolDiscoveryRequest {
    pub platform: String,
    pub candidates: Vec<NativeToolCandidate>,
    pub probe_timeout: Duration,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscoveryStatus {
    Available,
    Missing,
    PlatformMismatch,
    HashMismatch,
    VersionMismatch,
    NetworkForbidden,
    RedistributionForbidden,
    InvalidMetadata,
    UnsafePath,
    SymlinkForbidden,
    ProbeFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCapability {
    pub id: String,
    pub status: DiscoveryStatus,
    pub expected_version: String,
    pub detected_version: Option<String>,
    pub license: String,
    pub origin: String,
    pub platform: String,
    pub current_platform: String,
    pub expected_sha256: String,
    pub actual_sha256: Option<String>,
    pub network_allowed: bool,
    pub redistribution_allowed: bool,
    pub relative_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDiscoveryReport {
    pub platform: String,
    pub capabilities: Vec<ToolCapability>,
    pub manifest: ToolManifest,
}

pub async fn discover_tools(root: &Path, request: ToolDiscoveryRequest) -> ToolDiscoveryReport {
    let mut capabilities = Vec::with_capacity(request.candidates.len());
    let mut tools = Vec::new();
    for candidate in request.candidates {
        let mut capability = ToolCapability::from_candidate(&candidate, &request.platform);
        if candidate.network_allowed {
            capability.status = DiscoveryStatus::NetworkForbidden;
        } else if !candidate.redistribution_allowed {
            capability.status = DiscoveryStatus::RedistributionForbidden;
        } else if candidate.platform != request.platform {
            capability.status = DiscoveryStatus::PlatformMismatch;
        } else if !valid_metadata(&candidate) {
            capability.status = DiscoveryStatus::InvalidMetadata;
        } else if !safe_relative(&candidate.relative_path) {
            capability.status = DiscoveryStatus::UnsafePath;
        } else {
            let executable = root.join(&candidate.relative_path);
            match tokio::fs::symlink_metadata(&executable).await {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    capability.status = DiscoveryStatus::Missing;
                }
                Err(_) => capability.status = DiscoveryStatus::ProbeFailed,
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    capability.status = DiscoveryStatus::SymlinkForbidden;
                }
                Ok(metadata) if !metadata.is_file() => {
                    capability.status = DiscoveryStatus::Missing;
                }
                Ok(_) => match tokio::fs::read(&executable).await {
                    Err(_) => capability.status = DiscoveryStatus::ProbeFailed,
                    Ok(bytes) => {
                        let actual_sha256 = hex_digest(&bytes);
                        capability.actual_sha256 = Some(actual_sha256.clone());
                        if actual_sha256 != candidate.expected_sha256 {
                            capability.status = DiscoveryStatus::HashMismatch;
                        } else {
                            match capture_version(
                                &executable,
                                &candidate.version_arguments,
                                request.probe_timeout,
                            )
                            .await
                            {
                                Ok(version) => {
                                    capability.detected_version = Some(version.clone());
                                    if !version.contains(&candidate.version) {
                                        capability.status = DiscoveryStatus::VersionMismatch;
                                    } else {
                                        capability.status = DiscoveryStatus::Available;
                                        tools.push(ToolManifestEntry {
                                            id: candidate.id.clone(),
                                            version: candidate.version.clone(),
                                            license: candidate.license.clone(),
                                            origin: candidate.origin.clone(),
                                            platform: candidate.platform.clone(),
                                            relative_path: candidate.relative_path.clone(),
                                            sha256: candidate.expected_sha256.clone(),
                                            network_allowed: false,
                                            redistribution_allowed: true,
                                        });
                                    }
                                }
                                Err(()) => capability.status = DiscoveryStatus::ProbeFailed,
                            }
                        }
                    }
                },
            }
        }
        capabilities.push(capability);
    }
    ToolDiscoveryReport {
        platform: request.platform,
        capabilities,
        manifest: ToolManifest {
            manifest_version: 1,
            tools,
        },
    }
}

impl ToolCapability {
    fn from_candidate(candidate: &NativeToolCandidate, current_platform: &str) -> Self {
        Self {
            id: candidate.id.clone(),
            status: DiscoveryStatus::ProbeFailed,
            expected_version: candidate.version.clone(),
            detected_version: None,
            license: candidate.license.clone(),
            origin: candidate.origin.clone(),
            platform: candidate.platform.clone(),
            current_platform: current_platform.into(),
            expected_sha256: candidate.expected_sha256.clone(),
            actual_sha256: None,
            network_allowed: candidate.network_allowed,
            redistribution_allowed: candidate.redistribution_allowed,
            relative_path: candidate.relative_path.clone(),
        }
    }
}

fn valid_metadata(candidate: &NativeToolCandidate) -> bool {
    !candidate.id.trim().is_empty()
        && !candidate.version.trim().is_empty()
        && !candidate.license.trim().is_empty()
        && !candidate.origin.trim().is_empty()
        && !candidate.version_arguments.is_empty()
        && candidate.expected_sha256.len() == 64
        && candidate
            .expected_sha256
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
}

fn safe_relative(path: &Path) -> bool {
    !path.as_os_str().is_empty()
        && !path.is_absolute()
        && !path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
}

fn hex_digest(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

async fn capture_version(
    executable: &Path,
    arguments: &[String],
    timeout: Duration,
) -> Result<String, ()> {
    let mut child = Command::new(executable)
        .args(arguments)
        .env_clear()
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|_| ())?;
    let stdout = child.stdout.take().ok_or(())?;
    let stderr = child.stderr.take().ok_or(())?;
    let stdout_task = tokio::spawn(read_limited(stdout));
    let stderr_task = tokio::spawn(read_limited(stderr));
    let status = match tokio::time::timeout(timeout, child.wait()).await {
        Ok(Ok(status)) => status,
        _ => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            return Err(());
        }
    };
    let stdout = stdout_task.await.map_err(|_| ())??;
    let stderr = stderr_task.await.map_err(|_| ())??;
    if !status.success()
        || stdout.len() > VERSION_OUTPUT_LIMIT as usize
        || stderr.len() > VERSION_OUTPUT_LIMIT as usize
    {
        return Err(());
    }
    let output = if stdout.iter().any(|byte| !byte.is_ascii_whitespace()) {
        stdout
    } else {
        stderr
    };
    let version = String::from_utf8(output).map_err(|_| ())?.trim().to_owned();
    (!version.is_empty()).then_some(version).ok_or(())
}

async fn read_limited<R: tokio::io::AsyncRead + Unpin>(reader: R) -> Result<Vec<u8>, ()> {
    let mut bytes = Vec::new();
    reader
        .take(VERSION_OUTPUT_LIMIT + 1)
        .read_to_end(&mut bytes)
        .await
        .map_err(|_| ())?;
    Ok(bytes)
}
