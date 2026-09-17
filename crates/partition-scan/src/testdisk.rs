use std::path::{Path, PathBuf};

pub struct TestDiskInvocation {
    pub executable: PathBuf,
    pub args: Vec<String>,
    pub read_only: bool,
}

pub fn build_read_only_invocation(
    executable: &Path,
    image: &Path,
    log: &Path,
) -> TestDiskInvocation {
    TestDiskInvocation {
        executable: executable.to_path_buf(),
        args: vec![
            "/log".into(),
            "/debug".into(),
            image.display().to_string(),
            format!("/logname={}", log.display()),
        ],
        read_only: true,
    }
}
