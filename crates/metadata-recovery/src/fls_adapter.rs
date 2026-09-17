use std::path::{Path, PathBuf};

pub struct FlsInvocation {
    pub executable: PathBuf,
    pub args: Vec<String>,
}

pub fn build_fls_invocation(
    executable: &Path,
    image: &Path,
    partition_offset_sectors: u64,
) -> FlsInvocation {
    FlsInvocation {
        executable: executable.to_path_buf(),
        args: vec![
            "-r".into(),
            "-d".into(),
            "-p".into(),
            "-o".into(),
            partition_offset_sectors.to_string(),
            image.display().to_string(),
        ],
    }
}
