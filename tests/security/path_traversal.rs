use exporter::safe_relative_path;

#[test]
fn export_paths_reject_absolute_parent_and_drive_prefixes() {
    for value in [
        "../outside",
        "nested/../../outside",
        "/root/outside",
        r"C:\Windows\outside",
        r"\\server\share\outside",
    ] {
        assert!(safe_relative_path(value).is_err(), "accepted {value}");
    }
}
