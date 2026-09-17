use std::path::PathBuf;
use std::time::Duration;
use tool_runner::{
    DiscoveryStatus, ToolCandidateCatalog, ToolDiscoveryRequest, ToolRegistry, current_platform,
    discover_tools,
};

#[tokio::main]
async fn main() {
    match run().await {
        Ok(true) => {}
        Ok(false) => std::process::exit(2),
        Err(message) => {
            eprintln!("{message}");
            std::process::exit(1);
        }
    }
}

async fn run() -> Result<bool, String> {
    let arguments = Arguments::parse(std::env::args().skip(1))?;
    let catalog: ToolCandidateCatalog = serde_json::from_slice(
        &tokio::fs::read(&arguments.candidates)
            .await
            .map_err(|error| format!("cannot read candidate catalog: {error}"))?,
    )
    .map_err(|error| format!("invalid candidate catalog: {error}"))?;
    if catalog.schema_version != 1 {
        return Err("unsupported candidate catalog schema version".into());
    }
    catalog.validate()?;
    let report = discover_tools(
        &arguments.tools_root,
        ToolDiscoveryRequest {
            platform: current_platform().into(),
            candidates: catalog.candidates,
            probe_timeout: Duration::from_secs(5),
        },
    )
    .await;
    ToolRegistry::from_manifest(&arguments.tools_root, report.manifest.clone())
        .map_err(|error| format!("generated manifest is not loadable: {error}"))?;
    write_json(&arguments.manifest, &report.manifest).await?;
    write_json(&arguments.report, &report).await?;
    Ok(report
        .capabilities
        .iter()
        .all(|capability| capability.status == DiscoveryStatus::Available))
}

async fn write_json(path: &PathBuf, value: &impl serde::Serialize) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|error| format!("cannot create output directory: {error}"))?;
    }
    let mut bytes = serde_json::to_vec_pretty(value)
        .map_err(|error| format!("cannot serialize output: {error}"))?;
    bytes.push(b'\n');
    tokio::fs::write(path, bytes)
        .await
        .map_err(|error| format!("cannot write {}: {error}", path.display()))
}

struct Arguments {
    tools_root: PathBuf,
    candidates: PathBuf,
    manifest: PathBuf,
    report: PathBuf,
}

impl Arguments {
    fn parse(mut values: impl Iterator<Item = String>) -> Result<Self, String> {
        let mut tools_root = None;
        let mut candidates = None;
        let mut manifest = None;
        let mut report = None;
        while let Some(flag) = values.next() {
            let value = values
                .next()
                .ok_or_else(|| format!("missing value for {flag}"))?;
            match flag.as_str() {
                "--tools-root" => tools_root = Some(PathBuf::from(value)),
                "--candidates" => candidates = Some(PathBuf::from(value)),
                "--manifest" => manifest = Some(PathBuf::from(value)),
                "--report" => report = Some(PathBuf::from(value)),
                _ => return Err(format!("unknown argument: {flag}")),
            }
        }
        Ok(Self {
            tools_root: tools_root.ok_or("missing --tools-root")?,
            candidates: candidates.ok_or("missing --candidates")?,
            manifest: manifest.ok_or("missing --manifest")?,
            report: report.ok_or("missing --report")?,
        })
    }
}
