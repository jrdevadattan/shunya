use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileFamily {
    Jpeg,
    Png,
    Pdf,
    ZipDocument,
    AudioVideo,
    Archive,
    Database,
    ExecutableScript,
    Other,
}

impl FileFamily {
    pub(crate) fn photorec_name(self) -> &'static str {
        match self {
            Self::Jpeg => "jpg",
            Self::Png => "png",
            Self::Pdf => "pdf",
            Self::ZipDocument => "zip",
            Self::AudioVideo => "mov",
            Self::Archive => "7z",
            Self::Database => "sqlite",
            Self::ExecutableScript => "exe",
            Self::Other => "txt",
        }
    }
}

pub struct CarveRequest {
    pub image_path: PathBuf,
    pub job_directory: PathBuf,
    pub families: Vec<FileFamily>,
}

pub struct PhotoRecInvocation {
    pub tool_id: String,
    pub args: Vec<String>,
    pub output_root: PathBuf,
}
