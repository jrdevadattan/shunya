use crate::InventoryError;
use recovery_domain::{
    CapabilityFinding, CapabilityLevel, EncryptedState, SourceDescriptor, SourceHealth, SourceKind,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, File, Metadata};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

const SAMPLE_BYTES: usize = 64 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ImageFindingCode {
    MissingSegment,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ImageFinding {
    pub code: ImageFindingCode,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageSource {
    pub descriptor: SourceDescriptor,
    pub canonical_path: PathBuf,
    pub segments: Vec<PathBuf>,
    pub findings: Vec<ImageFinding>,
    pub sampled_fingerprint: String,
    pub file_identity: String,
}

pub fn identify_image(path: &Path) -> Result<ImageSource, InventoryError> {
    let metadata = fs::metadata(path)?;
    if !metadata.is_file() {
        return Err(InventoryError::NotAFile(path.display().to_string()));
    }
    let canonical_path = fs::canonicalize(path)?;
    let extension = canonical_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let numeric_segment =
        extension.len() == 3 && extension.bytes().all(|byte| byte.is_ascii_digit());
    if !numeric_segment && !matches!(extension.as_str(), "img" | "dd" | "raw") {
        return Err(InventoryError::UnsupportedImage(extension));
    }

    let (segments, findings) = if numeric_segment {
        discover_segments(&canonical_path)?
    } else {
        (vec![canonical_path.clone()], Vec::new())
    };
    let identity_segments = if segments.is_empty() {
        vec![canonical_path.clone()]
    } else {
        segments.clone()
    };
    let mut stable_hasher = Sha256::new();
    let mut total_size = 0_u64;
    let mut primary_fingerprint = String::new();
    let mut identities = Vec::new();
    for segment in &identity_segments {
        let segment_metadata = fs::metadata(segment)?;
        let fingerprint = sampled_fingerprint(segment, segment_metadata.len())?;
        if primary_fingerprint.is_empty() {
            primary_fingerprint.clone_from(&fingerprint);
        }
        let identity = file_identity(segment, &segment_metadata)?;
        identities.push(identity.clone());
        total_size = total_size.saturating_add(segment_metadata.len());
        stable_hasher.update(segment.as_os_str().to_string_lossy().as_bytes());
        stable_hasher.update(segment_metadata.len().to_le_bytes());
        stable_hasher.update(identity.as_bytes());
        stable_hasher.update(fingerprint.as_bytes());
    }
    let stable_id = hex(&stable_hasher.finalize());
    let display_name = canonical_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let capabilities = if findings.is_empty() {
        vec![CapabilityFinding {
            code: "IMAGE_SOURCE_READY".into(),
            level: CapabilityLevel::Supported,
            title: "Image ready".into(),
            explanation: "The image can be analyzed without writing to it.".into(),
            recommended_action: None,
        }]
    } else {
        vec![CapabilityFinding {
            code: "MISSING_SEGMENT".into(),
            level: CapabilityLevel::Unsupported,
            title: "Image segment is missing".into(),
            explanation: findings[0].detail.clone(),
            recommended_action: Some("Add the missing segment before continuing.".into()),
        }]
    };

    Ok(ImageSource {
        descriptor: SourceDescriptor {
            source_id: format!("image-{}", &stable_id[..24]),
            kind: SourceKind::RawImage,
            display_name,
            stable_id,
            size_bytes: total_size,
            logical_sector_size: None,
            physical_sector_size: None,
            bus: None,
            model: None,
            serial_redacted: None,
            system_disk: false,
            mounted_read_write: false,
            encrypted_state: EncryptedState::Unknown,
            health: SourceHealth::Unknown,
            capabilities,
        },
        canonical_path,
        segments,
        findings,
        sampled_fingerprint: primary_fingerprint,
        file_identity: identities.join("+"),
    })
}

fn discover_segments(path: &Path) -> Result<(Vec<PathBuf>, Vec<ImageFinding>), InventoryError> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    let mut indexed = Vec::new();
    for entry in fs::read_dir(parent)? {
        let entry = entry?;
        let candidate = entry.path();
        if candidate.file_stem().and_then(|value| value.to_str()) != Some(stem) {
            continue;
        }
        let Some(extension) = candidate.extension().and_then(|value| value.to_str()) else {
            continue;
        };
        if extension.len() == 3 && extension.bytes().all(|byte| byte.is_ascii_digit()) {
            indexed.push((
                extension.parse::<u32>().unwrap(),
                fs::canonicalize(candidate)?,
            ));
        }
    }
    indexed.sort_by_key(|(index, _)| *index);
    let mut findings = Vec::new();
    if let (Some((first, _)), Some((last, _))) = (indexed.first(), indexed.last()) {
        for expected in *first..=*last {
            if !indexed.iter().any(|(index, _)| *index == expected) {
                findings.push(ImageFinding {
                    code: ImageFindingCode::MissingSegment,
                    detail: format!("Expected segment {stem}.{expected:03} was not found."),
                });
            }
        }
    }
    if findings.is_empty() {
        Ok((
            indexed.into_iter().map(|(_, path)| path).collect(),
            findings,
        ))
    } else {
        Ok((Vec::new(), findings))
    }
}

fn sampled_fingerprint(path: &Path, size: u64) -> Result<String, InventoryError> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let positions = [
        0,
        size.saturating_sub(SAMPLE_BYTES as u64) / 2,
        size.saturating_sub(SAMPLE_BYTES as u64),
    ];
    for position in positions {
        file.seek(SeekFrom::Start(position))?;
        let mut buffer = vec![0_u8; SAMPLE_BYTES.min(size.saturating_sub(position) as usize)];
        file.read_exact(&mut buffer)?;
        hasher.update(position.to_le_bytes());
        hasher.update(buffer);
    }
    Ok(hex(&hasher.finalize()))
}

#[cfg(unix)]
fn file_identity(_path: &Path, metadata: &Metadata) -> Result<String, InventoryError> {
    use std::os::unix::fs::MetadataExt;
    Ok(format!("{}:{}", metadata.dev(), metadata.ino()))
}

#[cfg(windows)]
fn file_identity(path: &Path, _metadata: &Metadata) -> Result<String, InventoryError> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, GetFileInformationByHandle,
    };
    let file = File::open(path)?;
    let mut information: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
    let success = unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut information) };
    if success == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    let index =
        (u64::from(information.nFileIndexHigh) << 32) | u64::from(information.nFileIndexLow);
    Ok(format!("{}:{index}", information.dwVolumeSerialNumber))
}

#[cfg(not(any(unix, windows)))]
fn file_identity(_path: &Path, metadata: &Metadata) -> Result<String, InventoryError> {
    Ok(format!("{}:{:?}", metadata.len(), metadata.modified().ok()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}
