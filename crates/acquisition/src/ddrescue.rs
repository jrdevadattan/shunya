use std::path::{Path, PathBuf};
use std::time::Duration;
use tool_runner::ToolInvocation;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct DdrescueProgress {
    pub rescued_bytes: Option<u64>,
    pub error_bytes: Option<u64>,
    pub error_areas: Option<u64>,
    pub current_rate: Option<u64>,
    pub average_rate: Option<u64>,
    pub current_pass: Option<u32>,
    pub unparsed_lines: Vec<String>,
}

impl DdrescueProgress {
    pub fn parse(lines: &[String]) -> Self {
        let mut progress = Self::default();
        for line in lines {
            let normalized = line.replace(',', " ");
            let mut recognized = false;
            for (label, target) in [
                ("rescued:", &mut progress.rescued_bytes),
                ("errsize:", &mut progress.error_bytes),
                ("current rate:", &mut progress.current_rate),
                ("average rate:", &mut progress.average_rate),
            ] {
                if let Some(value) = number_after(&normalized, label) {
                    *target = Some(value);
                    recognized = true;
                }
            }
            if let Some(value) = number_after(&normalized, "errors:") {
                progress.error_areas = Some(value);
                recognized = true;
            }
            if let Some(value) = number_after(&normalized, "pass:") {
                progress.current_pass = u32::try_from(value).ok();
                recognized = true;
            }
            if !recognized && !line.trim().is_empty() {
                progress.unparsed_lines.push(line.clone());
            }
        }
        progress
    }
}

fn number_after(line: &str, label: &str) -> Option<u64> {
    let lower = line.to_ascii_lowercase();
    let start = lower.find(label)? + label.len();
    line[start..]
        .split_whitespace()
        .next()?
        .replace('_', "")
        .parse()
        .ok()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DdrescueRun {
    pub source: PathBuf,
    pub destination: PathBuf,
    pub mapfile: PathBuf,
}

#[derive(Default)]
pub struct DdrescueAdapter;
impl DdrescueAdapter {
    pub fn first_pass(&self, run: &DdrescueRun, working_directory: &Path) -> ToolInvocation {
        self.invocation(run, working_directory, vec!["-n".into(), "--force".into()])
    }
    pub fn resume(&self, run: &DdrescueRun, working_directory: &Path) -> ToolInvocation {
        self.first_pass(run, working_directory)
    }
    pub fn retry_pass(
        &self,
        run: &DdrescueRun,
        retries: u8,
        working_directory: &Path,
    ) -> ToolInvocation {
        self.invocation(
            run,
            working_directory,
            vec![
                "--direct".into(),
                format!("--retry-passes={retries}"),
                "--force".into(),
            ],
        )
    }
    fn invocation(
        &self,
        run: &DdrescueRun,
        working_directory: &Path,
        mut args: Vec<String>,
    ) -> ToolInvocation {
        args.extend([
            run.source.to_string_lossy().into_owned(),
            run.destination.to_string_lossy().into_owned(),
            run.mapfile.to_string_lossy().into_owned(),
        ]);
        ToolInvocation {
            tool_id: "ddrescue".into(),
            args,
            working_directory: working_directory.into(),
            timeout: Duration::from_secs(7 * 24 * 60 * 60),
            environment: Vec::new(),
        }
    }
}
