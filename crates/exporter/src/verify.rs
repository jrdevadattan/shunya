use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

pub fn sha256(path: &Path) -> std::io::Result<String> {
    Ok(Sha256::digest(fs::read(path)?)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}
