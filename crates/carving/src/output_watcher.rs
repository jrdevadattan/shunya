use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

pub fn stable_output_files(root: &Path, quiet_period: Duration) -> std::io::Result<Vec<PathBuf>> {
    let threshold = SystemTime::now()
        .checked_sub(quiet_period)
        .unwrap_or(SystemTime::UNIX_EPOCH);
    let mut files = Vec::new();
    if !root.exists() {
        return Ok(files);
    }
    for directory in fs::read_dir(root)? {
        let directory = directory?;
        if directory.file_type()?.is_dir() {
            for entry in fs::read_dir(directory.path())? {
                let entry = entry?;
                let metadata = entry.metadata()?;
                if metadata.is_file()
                    && metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH) <= threshold
                {
                    files.push(entry.path());
                }
            }
        }
    }
    files.sort();
    Ok(files)
}
