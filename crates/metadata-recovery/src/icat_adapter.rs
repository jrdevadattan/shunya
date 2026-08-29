use crate::MetadataRecoveryError;
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub struct IcatInvocation {
    pub executable: PathBuf,
    pub args: Vec<String>,
}

pub fn build_icat_invocation(
    executable: &Path,
    image: &Path,
    partition_offset_sectors: u64,
    metadata_address: &str,
) -> IcatInvocation {
    IcatInvocation {
        executable: executable.to_path_buf(),
        args: vec![
            "-r".into(),
            "-o".into(),
            partition_offset_sectors.to_string(),
            image.display().to_string(),
            metadata_address.into(),
        ],
    }
}

pub fn write_extracted_content(
    mut input: impl Read,
    output: &Path,
) -> Result<(u64, String), MetadataRecoveryError> {
    let mut file = File::create(output)?;
    let mut hasher = Sha256::new();
    let mut total = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = input.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        file.write_all(&buffer[..count])?;
        hasher.update(&buffer[..count]);
        total += count as u64;
    }
    file.sync_all()?;
    Ok((
        total,
        hasher
            .finalize()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect(),
    ))
}
