use std::path::{Path, PathBuf};

pub const CASE_DIRECTORIES: &[&str] = &[
    "audit",
    "sources",
    "images",
    "maps",
    "work",
    "recovered/quarantine",
    "previews",
    "exports",
    "logs/tools",
    "reports",
];

pub fn manifest_path(root: &Path) -> PathBuf {
    root.join("case.json")
}

pub fn database_path(root: &Path) -> PathBuf {
    root.join("case.sqlite")
}

pub fn audit_path(root: &Path) -> PathBuf {
    root.join("audit/events.ndjson")
}
