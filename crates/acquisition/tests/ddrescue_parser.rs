use acquisition::DdrescueProgress;

#[test]
fn ddrescue_status_is_normalized_and_unknown_lines_are_preserved() {
    let lines = vec![
        "rescued: 1048576 B, errsize: 4096 B, current rate: 65536 B/s".into(),
        "errors: 2, average rate: 32768 B/s, pass: 1".into(),
        "future-field: retained".into(),
    ];
    let progress = DdrescueProgress::parse(&lines);
    assert_eq!(progress.rescued_bytes, Some(1_048_576));
    assert_eq!(progress.error_bytes, Some(4096));
    assert_eq!(progress.error_areas, Some(2));
    assert_eq!(progress.current_rate, Some(65_536));
    assert_eq!(progress.average_rate, Some(32_768));
    assert_eq!(progress.current_pass, Some(1));
    assert_eq!(progress.unparsed_lines, vec!["future-field: retained"]);
}
