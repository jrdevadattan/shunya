mod support;

use std::time::Duration;
use support::fixture_registry;
use tokio_util::sync::CancellationToken;
use tool_runner::{ProcessStatus, ToolInvocation, ToolRunner};

#[tokio::test]
async fn cancellation_terminates_the_process_and_preserves_raw_logs() {
    let fixture = fixture_registry();
    let working = fixture.root.path().join("cancel-job");
    let runner = ToolRunner::new(fixture.registry, 1024 * 1024);
    let token = CancellationToken::new();
    let cancel = token.clone();
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(100)).await;
        cancel.cancel();
    });
    let outcome = runner
        .execute(
            ToolInvocation {
                tool_id: "fixture".into(),
                args: vec!["sleep".into()],
                working_directory: working.clone(),
                timeout: Duration::from_secs(30),
                environment: vec![],
            },
            token,
        )
        .await
        .unwrap();
    assert_eq!(outcome.status, ProcessStatus::Cancelled);
    assert!(working.join("tool.stdout.log").exists());
    assert!(working.join("tool.stderr.log").exists());
}
