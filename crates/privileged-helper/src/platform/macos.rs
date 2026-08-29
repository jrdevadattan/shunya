#[cfg(target_os = "macos")]
pub fn is_allowed_device_path(path: &str) -> bool {
    (path.starts_with("/dev/rdisk") || path.starts_with("/dev/disk")) && !path.contains("..")
}
