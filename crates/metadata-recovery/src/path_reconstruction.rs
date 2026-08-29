pub fn normalize_path(path: &str) -> String {
    let normalized = path.replace('\\', "/").trim_start_matches('/').to_owned();
    format!("/{normalized}")
}
