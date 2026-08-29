use std::fs;
use std::path::Path;

pub fn prepare_quarantine(path: &Path) -> std::io::Result<()> {
    fs::create_dir_all(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    #[cfg(windows)]
    fs::write(
        path.join(".quarantine-policy.json"),
        b"{\"autoLaunch\":false,\"activeContent\":\"blocked\"}\n",
    )?;
    Ok(())
}
