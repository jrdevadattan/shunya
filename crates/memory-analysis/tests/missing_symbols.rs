use memory_analysis::MemoryAnalyzer;

#[test]
fn missing_symbols_explain_probable_os_plugin_and_next_step() {
    let outcome = MemoryAnalyzer.missing_symbols(
        "windows.netscan.NetScan",
        "Windows 11 23H2",
        vec!["Unsatisfied requirement: kernel.layer_name".into()],
    );
    assert_eq!(outcome.probable_os, "Windows 11 23H2");
    assert!(
        outcome
            .explanation
            .unwrap()
            .contains("windows.netscan.NetScan")
    );
    assert!(outcome.suggested_next_step.unwrap().contains("symbol"));
}
