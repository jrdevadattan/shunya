#[cfg(target_os = "linux")]
pub fn is_allowed_device_path(path: &str) -> bool {
    path.starts_with("/dev/") && !path.contains("..")
}
