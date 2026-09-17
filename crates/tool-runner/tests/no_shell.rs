mod support;

use std::time::Duration;
use support::fixture_registry;
use tokio_util::sync::CancellationToken;
use tool_runner::{ToolInvocation, ToolRunner};

#[tokio::test]
async fn passes_shell_metacharacters_as_one_literal_argument() {
    let fixture = fixture_registry();
    let argument = "one value; $(not-run) & | > file";
    let runner = ToolRunner::new(fixture.registry, 1024 * 1024);
    let outcome = runner
        .execute(
            ToolInvocation {
                tool_id: "fixture".into(),
                args: vec!["echo".into(), argument.into()],
                working_directory: fixture.root.path().join("job"),
                timeout: Duration::from_secs(5),
                environment: vec![],
            },
            CancellationToken::new(),
        )
        .await
        .unwrap();
    assert!(outcome.stdout.iter().any(|line| line == argument));
}
