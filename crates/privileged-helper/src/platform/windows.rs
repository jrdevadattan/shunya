#[cfg(windows)]
pub fn is_allowed_device_path(path: &str) -> bool {
    path.starts_with(r"\\.\PhysicalDrive")
        && path[17..]
            .chars()
            .all(|character| character.is_ascii_digit())
}
