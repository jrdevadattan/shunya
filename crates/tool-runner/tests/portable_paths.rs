use tool_runner::is_portable_tool_relative_path;

#[test]
fn portable_tool_paths_accept_only_cross_platform_relative_forms() {
    for path in [
        "tool",
        "vendor/windows-x64/tool.exe",
        "vendor/linux-x64/lib/tool",
        "vendor/macos-arm64/工具",
    ] {
        assert!(
            is_portable_tool_relative_path(path),
            "expected safe path: {path:?}"
        );
    }
}

#[test]
fn portable_tool_paths_reject_windows_posix_and_ambiguous_forms_on_every_host() {
    for path in [
        "",
        ".",
        "..",
        "/usr/bin/tool",
        "vendor/../escape",
        "vendor/./tool",
        "vendor//tool",
        "vendor/tool/",
        "C:/Windows/tool.exe",
        "C:relative/tool.exe",
        r"C:\Windows\tool.exe",
        r"vendor\..\escape.exe",
        r"\\server\share\tool.exe",
        r"\\?\C:\tool.exe",
        r"\\.\PhysicalDrive0",
        "vendor/tool:stream",
        "vendor/NUL.exe",
        "vendor/com1",
        "vendor/trailing. ",
        "vendor/question?.exe",
    ] {
        assert!(
            !is_portable_tool_relative_path(path),
            "expected unsafe path: {path:?}"
        );
    }
}
