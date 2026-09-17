use exporter::safe_relative_path;
use std::path::Path;

#[test]
fn traversal_absolute_reserved_and_overlong_components_are_contained() {
    for unsafe_path in ["../../escape.exe", "/absolute/file", "C:\\absolute\\file"] {
        assert!(safe_relative_path(unsafe_path).is_err());
    }
    assert_eq!(
        safe_relative_path("CON/report.txt").unwrap(),
        Path::new("_CON").join("report.txt")
    );
    assert_eq!(
        safe_relative_path("folder/name. ").unwrap(),
        Path::new("folder").join("name")
    );
    let long = format!("{}.txt", "a".repeat(400));
    assert!(
        safe_relative_path(&long)
            .unwrap()
            .file_name()
            .unwrap()
            .to_string_lossy()
            .len()
            <= 240
    );
}
