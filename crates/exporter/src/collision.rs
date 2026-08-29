use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use unicode_normalization::UnicodeNormalization;

#[derive(Default)]
pub struct CollisionResolver {
    seen: BTreeMap<String, usize>,
}

impl CollisionResolver {
    pub fn resolve(&mut self, path: &Path) -> PathBuf {
        let key = path
            .to_string_lossy()
            .nfc()
            .collect::<String>()
            .to_lowercase();
        let count = self
            .seen
            .entry(key)
            .and_modify(|value| *value += 1)
            .or_insert(1);
        if *count == 1 {
            return path.to_path_buf();
        }
        let parent = path.parent().unwrap_or_else(|| Path::new(""));
        let stem = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("recovered");
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{value}"))
            .unwrap_or_default();
        parent.join(format!("{stem} ({count}){extension}"))
    }
}
