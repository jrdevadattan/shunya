use crate::{ImageIoError, RawImageReader, SourceReader};
use async_trait::async_trait;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tool_runner::ToolInvocation;

pub struct EwfImageReader {
    raw: RawImageReader,
    segments: Vec<PathBuf>,
}

impl EwfImageReader {
    pub async fn open_exported_raw(
        first_segment: &Path,
        exported_raw: &Path,
    ) -> Result<Self, EwfError> {
        let segments = discover_segments(first_segment)?;
        Ok(Self {
            raw: RawImageReader::open(exported_raw).await?,
            segments,
        })
    }
    pub fn segments(&self) -> &[PathBuf] {
        &self.segments
    }
}

#[async_trait]
impl SourceReader for EwfImageReader {
    fn len(&self) -> u64 {
        self.raw.len()
    }
    async fn read_exact_at(&self, offset: u64, buffer: &mut [u8]) -> Result<(), ImageIoError> {
        self.raw.read_exact_at(offset, buffer).await
    }
    fn verify_unchanged(&self) -> Result<(), ImageIoError> {
        self.raw.verify_unchanged()
    }
}

pub fn discover_segments(first_segment: &Path) -> Result<Vec<PathBuf>, EwfError> {
    let extension = first_segment
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    if !matches!(extension.to_ascii_uppercase().as_str(), "E01" | "EX01") {
        return Err(EwfError::InvalidFirstSegment);
    }
    let stem = first_segment
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or(EwfError::InvalidFirstSegment)?;
    let directory = first_segment.parent().unwrap_or_else(|| Path::new("."));
    let prefix = if extension.eq_ignore_ascii_case("EX01") {
        "Ex"
    } else {
        "E"
    };
    let mut paths = Vec::new();
    for number in 1..=999 {
        let candidate = directory.join(format!("{stem}.{prefix}{number:02}"));
        if candidate.exists() {
            paths.push(candidate);
        } else if number == 1 {
            return Err(EwfError::MissingSegment(candidate));
        } else {
            let later_exists = ((number + 1)..=(number + 4).min(999)).any(|later| {
                directory
                    .join(format!("{stem}.{prefix}{later:02}"))
                    .exists()
            });
            if later_exists {
                return Err(EwfError::MissingSegment(candidate));
            }
            break;
        }
    }
    Ok(paths)
}

#[derive(Default)]
pub struct EwfToolAdapter;
impl EwfToolAdapter {
    pub fn info_invocation(
        &self,
        first_segment: &Path,
        working_directory: &Path,
    ) -> ToolInvocation {
        invocation(
            "ewfinfo",
            vec![first_segment.to_string_lossy().into_owned()],
            working_directory,
        )
    }
    pub fn verify_invocation(
        &self,
        first_segment: &Path,
        working_directory: &Path,
    ) -> ToolInvocation {
        invocation(
            "ewfverify",
            vec![first_segment.to_string_lossy().into_owned()],
            working_directory,
        )
    }
    pub fn export_invocation(
        &self,
        first_segment: &Path,
        output_base: &Path,
        working_directory: &Path,
    ) -> ToolInvocation {
        invocation(
            "ewfexport",
            vec![
                "-t".into(),
                output_base.to_string_lossy().into_owned(),
                first_segment.to_string_lossy().into_owned(),
            ],
            working_directory,
        )
    }
    pub fn normalize_verification(
        &self,
        exit_code: Option<i32>,
        stdout: &[String],
        stderr: &[String],
    ) -> EwfVerification {
        EwfVerification {
            verified: exit_code == Some(0),
            raw_output: stdout.iter().chain(stderr).cloned().collect(),
            failure: (exit_code != Some(0))
                .then(|| "libewf verifier reported integrity failure".into()),
        }
    }
}

fn invocation(tool_id: &str, args: Vec<String>, working_directory: &Path) -> ToolInvocation {
    ToolInvocation {
        tool_id: tool_id.into(),
        args,
        working_directory: working_directory.into(),
        timeout: Duration::from_secs(60 * 60),
        environment: Vec::new(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EwfVerification {
    pub verified: bool,
    pub raw_output: Vec<String>,
    pub failure: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum EwfError {
    #[error("MISSING_SEGMENT: {0}")]
    MissingSegment(PathBuf),
    #[error("first EWF path must end in E01 or Ex01")]
    InvalidFirstSegment,
    #[error("image I/O error: {0}")]
    Image(#[from] ImageIoError),
}
