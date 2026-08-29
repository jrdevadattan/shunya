use memory_analysis::{MemoryAnalyzer, NormalizedTable};

#[test]
fn volatility_json_processes_and_network_rows_are_typed() {
    let analyzer = MemoryAnalyzer;
    let process_json = serde_json::json!({"columns":["PID","PPID","ImageFileName","Args"],"rows":[[4,0,"System","System"],[824,4,"svchost.exe","svchost.exe -k netsvcs"]]});
    let outcome = analyzer
        .normalize_plugin("windows.pslist.PsList", "Windows 11", &process_json, vec![])
        .unwrap();
    let NormalizedTable::Processes(rows) = outcome.table.unwrap() else {
        panic!("expected process table")
    };
    assert_eq!(rows[1].pid, 824);
    assert_eq!(rows[1].image_name, "svchost.exe");
    let network_json = serde_json::json!([{"Proto":"TCPv4","LocalAddr":"10.0.0.2:443","ForeignAddr":"10.0.0.3:52000","State":"ESTABLISHED","PID":824}]);
    let outcome = analyzer
        .normalize_plugin(
            "windows.netscan.NetScan",
            "Windows 11",
            &network_json,
            vec![],
        )
        .unwrap();
    let NormalizedTable::Network(rows) = outcome.table.unwrap() else {
        panic!("expected network table")
    };
    assert_eq!(rows[0].pid, Some(824));
}
