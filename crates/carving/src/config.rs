use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Coarse file families an operator can select for signature carving.
///
/// Both the built-in engine and the PhotoRec adapter map their concrete
/// formats onto these families, so the UI never has to know tool-specific
/// format names.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FileFamily {
    Images,
    Documents,
    Archives,
    AudioVideo,
    Databases,
    Executables,
}

impl FileFamily {
    pub const ALL: [FileFamily; 6] = [
        FileFamily::Images,
        FileFamily::Documents,
        FileFamily::Archives,
        FileFamily::AudioVideo,
        FileFamily::Databases,
        FileFamily::Executables,
    ];

    pub fn label(self) -> &'static str {
        match self {
            Self::Images => "Images",
            Self::Documents => "Documents",
            Self::Archives => "Archives",
            Self::AudioVideo => "Audio and video",
            Self::Databases => "Databases",
            Self::Executables => "Executables",
        }
    }

    /// PhotoRec `fileopt` names enabled for this family.
    pub(crate) fn photorec_names(self) -> &'static [&'static str] {
        match self {
            Self::Images => &["jpg", "png", "gif", "bmp", "tiff", "riff"],
            Self::Documents => &["pdf", "doc", "zip"],
            Self::Archives => &["zip", "7z", "rar", "gz", "bz2", "tar"],
            Self::AudioVideo => &["mov", "mp3", "riff", "mkv", "ogg", "flac"],
            Self::Databases => &["sqlite"],
            Self::Executables => &["exe", "elf"],
        }
    }

    /// MIME types the validation registry can assign to members of this family.
    pub fn mime_types(self) -> &'static [&'static str] {
        match self {
            Self::Images => &[
                "image/jpeg",
                "image/png",
                "image/gif",
                "image/bmp",
                "image/webp",
                "image/tiff",
            ],
            Self::Documents => &[
                "application/pdf",
                "text/plain",
                "application/msword",
                "application/vnd.ms-excel",
                "application/vnd.ms-powerpoint",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "application/vnd.oasis.opendocument.text",
                "application/vnd.oasis.opendocument.spreadsheet",
                "application/vnd.oasis.opendocument.presentation",
                "application/x-ole-storage",
            ],
            Self::Archives => &[
                "application/zip",
                "application/x-7z-compressed",
                "application/vnd.rar",
                "application/gzip",
                "application/x-bzip2",
                "application/x-tar",
            ],
            Self::AudioVideo => &[
                "video/mp4",
                "video/quicktime",
                "video/3gpp",
                "audio/mp4",
                "audio/mpeg",
                "audio/wav",
                "video/x-msvideo",
                "video/x-matroska",
                "audio/ogg",
                "audio/flac",
            ],
            Self::Databases => &["application/x-sqlite3"],
            Self::Executables => &[
                "application/vnd.microsoft.portable-executable",
                "application/x-executable",
                "application/java-archive",
                "application/vnd.android.package-archive",
            ],
        }
    }

    /// Best-effort family for a file extension, used for tool output that
    /// arrives as plain files (PhotoRec names carved files by extension).
    pub fn from_extension(extension: &str) -> Option<FileFamily> {
        let extension = extension.trim_start_matches('.').to_ascii_lowercase();
        Some(match extension.as_str() {
            "jpg" | "jpeg" | "png" | "gif" | "bmp" | "tif" | "tiff" | "webp" => Self::Images,
            "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "odt" | "ods" | "odp"
            | "txt" | "rtf" | "ole" => Self::Documents,
            "zip" | "7z" | "rar" | "gz" | "tgz" | "bz2" | "tar" => Self::Archives,
            "mov" | "mp4" | "m4a" | "m4v" | "3gp" | "mp3" | "wav" | "avi" | "mkv" | "ogg"
            | "flac" | "webm" | "cda" => Self::AudioVideo,
            "sqlite" | "db" | "sqlite3" => Self::Databases,
            "exe" | "dll" | "elf" | "jar" | "apk" | "msi" | "sys" => Self::Executables,
            _ => return None,
        })
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
