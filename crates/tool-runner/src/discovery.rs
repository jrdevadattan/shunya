use crate::{ToolManifest, ToolManifestEntry, is_portable_tool_relative_path};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
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

impl ToolCandidateCatalog {
    pub fn validate(&self) -> Result<(), String> {
        let mut ids = BTreeSet::new();
        for candidate in &self.candidates {
            if !ids.insert(candidate.id.as_str()) {
                return Err(format!("duplicate tool ID: {}", candidate.id));
            }
        }
        Ok(())
    }
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
    let canonical_root = tokio::fs::canonicalize(root).await.ok();
    let mut seen_ids = BTreeSet::new();
    let mut duplicate_ids = BTreeSet::new();
    for candidate in &request.candidates {
        if !seen_ids.insert(candidate.id.clone()) {
            duplicate_ids.insert(candidate.id.clone());
        }
    }
    for candidate in request.candidates {
        let mut capability = ToolCapability::from_candidate(&candidate, &request.platform);
        if duplicate_ids.contains(candidate.id.as_str()) {
            capability.status = DiscoveryStatus::InvalidMetadata;
        } else if candidate.network_allowed {
            capability.status = DiscoveryStatus::NetworkForbidden;
        } else if !candidate.redistribution_allowed {
            capability.status = DiscoveryStatus::RedistributionForbidden;
        } else if candidate.platform != request.platform {
            capability.status = DiscoveryStatus::PlatformMismatch;
        } else if !valid_metadata(&candidate) {
            capability.status = DiscoveryStatus::InvalidMetadata;
        } else if !candidate
            .relative_path
            .to_str()
            .is_some_and(is_portable_tool_relative_path)
        {
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
                Ok(_) => match (
                    canonical_root.as_ref(),
                    tokio::fs::canonicalize(&executable).await.ok(),
                ) {
                    (Some(canonical_root), Some(resolved))
                        if !resolved.starts_with(canonical_root) =>
                    {
                        capability.status = DiscoveryStatus::SymlinkForbidden;
                    }
                    (None, _) | (_, None) => capability.status = DiscoveryStatus::ProbeFailed,
                    (_, Some(resolved)) => match tokio::fs::read(&resolved).await {
                        Err(_) => capability.status = DiscoveryStatus::ProbeFailed,
                        Ok(bytes) => {
                            let actual_sha256 = hex_digest(&bytes);
                            capability.actual_sha256 = Some(actual_sha256.clone());
                            if actual_sha256 != candidate.expected_sha256 {
                                capability.status = DiscoveryStatus::HashMismatch;
                            } else {
                                match capture_version(
                                    &resolved,
                                    &candidate.version_arguments,
                                    request.probe_timeout,
                                )
                                .await
                                {
                                    Ok(version) => {
                                        capability.detected_version = Some(version.clone());
                                        if !version_matches(&version, &candidate.version) {
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
    let deadline = tokio::time::Instant::now() + timeout;
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
    let mut stdout_task = tokio::spawn(read_limited(stdout));
    let mut stderr_task = tokio::spawn(read_limited(stderr));
    let status = match tokio::time::timeout_at(deadline, child.wait()).await {
        Ok(Ok(status)) => status,
        _ => {
            cleanup_probe(&mut child, &mut stdout_task, &mut stderr_task).await;
            return Err(());
        }
    };
    let drains = async {
        let stdout = (&mut stdout_task).await.map_err(|_| ())??;
        let stderr = (&mut stderr_task).await.map_err(|_| ())??;
        Ok::<_, ()>((stdout, stderr))
    };
    let (stdout, stderr) = match tokio::time::timeout_at(deadline, drains).await {
        Ok(Ok(output)) => output,
        _ => {
            cleanup_probe(&mut child, &mut stdout_task, &mut stderr_task).await;
            return Err(());
        }
    };
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

async fn cleanup_probe(
    child: &mut tokio::process::Child,
    stdout_task: &mut tokio::task::JoinHandle<Result<Vec<u8>, ()>>,
    stderr_task: &mut tokio::task::JoinHandle<Result<Vec<u8>, ()>>,
) {
    stdout_task.abort();
    stderr_task.abort();
    let _ = child.start_kill();
    let _ = tokio::time::timeout(Duration::from_millis(250), child.wait()).await;
    let _ = stdout_task.await;
    let _ = stderr_task.await;
}

fn version_matches(output: &str, expected: &str) -> bool {
    let expected = normalized_version(expected);
    output
        .split(|character: char| {
            !(character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_' | '+'))
        })
        .filter(|token| !token.is_empty())
        .any(|token| normalized_version(token) == expected)
}

fn normalized_version(version: &str) -> &str {
    let version = version.trim();
    match version.strip_prefix(['v', 'V']) {
        Some(remainder) if remainder.starts_with(|character: char| character.is_ascii_digit()) => {
            remainder
        }
        _ => version,
    }
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
