use crate::{ProcessOutcome, ProcessStatus, ToolInvocation, ToolRegistry, ToolRunnerError, logs};
use std::process::Stdio;
use tokio::process::Command;
use tokio_util::sync::CancellationToken;

pub struct ToolRunner {
    registry: ToolRegistry,
    output_limit: usize,
}

impl ToolRunner {
    pub fn new(registry: ToolRegistry, output_limit: usize) -> Self {
        Self {
            registry,
            output_limit,
        }
    }

    pub async fn execute(
        &self,
        invocation: ToolInvocation,
        cancellation: CancellationToken,
    ) -> Result<ProcessOutcome, ToolRunnerError> {
        let executable = self.registry.load_and_verify(&invocation.tool_id)?;
        std::fs::create_dir_all(&invocation.working_directory)?;
        let mut command = Command::new(executable);
        command
            .args(&invocation.args)
            .current_dir(&invocation.working_directory)
            .env_clear()
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        for (key, value) in &invocation.environment {
            command.env(key, value);
        }
        let mut child = command.spawn()?;
        let stdout = child.stdout.take().expect("piped stdout");
        let stderr = child.stderr.take().expect("piped stderr");
        let stdout_task = tokio::spawn(logs::capture(
            stdout,
            invocation.working_directory.join("tool.stdout.log"),
            self.output_limit,
        ));
        let stderr_task = tokio::spawn(logs::capture(
            stderr,
            invocation.working_directory.join("tool.stderr.log"),
            self.output_limit,
        ));
        let status = tokio::select! {
            result = child.wait() => ProcessStatus::Exited(result?.code()),
            _ = cancellation.cancelled() => { let _ = child.start_kill(); let _ = child.wait().await; ProcessStatus::Cancelled },
            _ = tokio::time::sleep(invocation.timeout) => { let _ = child.start_kill(); let _ = child.wait().await; ProcessStatus::TimedOut },
        };
        let stdout = stdout_task
            .await
            .map_err(|error| ToolRunnerError::Task(error.to_string()))??;
        let stderr = stderr_task
            .await
            .map_err(|error| ToolRunnerError::Task(error.to_string()))??;
        Ok(ProcessOutcome {
            status,
            stdout,
            stderr,
        })
    }
}
