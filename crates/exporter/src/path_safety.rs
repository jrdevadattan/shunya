use crate::ExportError;
use std::path::{Path, PathBuf};
use unicode_normalization::UnicodeNormalization;

const RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

pub fn safe_relative_path(input: &str) -> Result<PathBuf, ExportError> {
    if input.starts_with(['/', '\\']) || input.as_bytes().get(1) == Some(&b':') {
        return Err(ExportError::UnsafePath(input.into()));
    }
    let mut output = PathBuf::new();
    for raw in input.split(['/', '\\']) {
        if raw.is_empty() || raw == "." {
            continue;
        }
        if raw == ".." {
            return Err(ExportError::UnsafePath(input.into()));
        }
        let normalized: String = raw.nfc().collect();
        let trimmed = normalized.trim_end_matches(['.', ' ']);
        if trimmed.is_empty() {
            continue;
        }
        let stem = trimmed
            .split('.')
            .next()
            .unwrap_or(trimmed)
            .to_ascii_uppercase();
        let mut safe = if RESERVED.contains(&stem.as_str()) {
            format!("_{trimmed}")
        } else {
            trimmed.to_owned()
        };
        if safe.chars().count() > 240 {
            let extension = Path::new(&safe)
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| format!(".{value}"))
                .unwrap_or_default();
            safe = format!(
                "{}{}",
                safe.chars()
                    .take(240_usize.saturating_sub(extension.len()))
                    .collect::<String>(),
                extension
            );
        }
        output.push(safe);
    }
    if output.as_os_str().is_empty() {
        return Err(ExportError::UnsafePath(input.into()));
    }
    Ok(output)
}
