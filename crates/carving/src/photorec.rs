use crate::{CarveRequest, CarvingError, PhotoRecInvocation};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Builds the PhotoRec command line for an unattended, read-only carve.
///
/// PhotoRec writes into `<recup>.1`, `<recup>.2`, and so on, so the `/d`
/// prefix lives inside a dedicated output root that `collect_output` can walk
/// afterwards.
pub fn build_invocation(request: &CarveRequest) -> Result<PhotoRecInvocation, CarvingError> {
    if request.families.is_empty() {
        return Err(CarvingError::NoFileFamilies);
    }
    let output_root = request.job_directory.join("photorec-output");
    let mut commands = vec![
        "partition_none".to_owned(),
        "fileopt".to_owned(),
        "everything,disable".to_owned(),
    ];
    let mut enabled = Vec::new();
    for family in &request.families {
        for name in family.photorec_names() {
            if !enabled.contains(name) {
                enabled.push(*name);
            }
        }
    }
    commands.extend(enabled.iter().map(|name| format!("{name},enable")));
    commands.push("wholespace".into());
    commands.push("search".into());
    Ok(PhotoRecInvocation {
        tool_id: "photorec".into(),
        args: vec![
            "/d".into(),
            output_root.join("recup").display().to_string(),
            "/cmd".into(),
            request.image_path.display().to_string(),
            commands.join(","),
        ],
        output_root,
    })
}

/// One file PhotoRec wrote, with the source byte runs its DFXML report recorded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhotoRecFile {
    pub path: PathBuf,
    pub extension: Option<String>,
    /// `(image offset, length)` pairs from `report.xml`; empty when unreported.
    pub byte_runs: Vec<(u64, u64)>,
}

/// Collects every carved file beneath the PhotoRec output root, in stable order.
pub fn collect_output(output_root: &Path) -> Result<Vec<PhotoRecFile>, CarvingError> {
    let mut files = Vec::new();
    if !output_root.exists() {
        return Ok(files);
    }
    let mut directories = Vec::new();
    for entry in fs::read_dir(output_root)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() {
            directories.push(entry.path());
        }
    }
    directories.sort();
    for directory in directories {
        let runs = parse_report(&directory.join("report.xml"));
        let mut paths = Vec::new();
        for entry in fs::read_dir(&directory)? {
            let entry = entry?;
            if entry.file_type()?.is_file() {
                paths.push(entry.path());
            }
        }
        paths.sort();
        for path in paths {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            if name.eq_ignore_ascii_case("report.xml") || name.starts_with('.') {
                continue;
            }
            files.push(PhotoRecFile {
                extension: path
                    .extension()
                    .and_then(|value| value.to_str())
                    .map(str::to_ascii_lowercase),
                byte_runs: runs.get(name).cloned().unwrap_or_default(),
                path,
            });
        }
    }
    Ok(files)
}

/// Extracts `<fileobject>` byte runs from the DFXML `report.xml` PhotoRec writes.
///
/// The parser is deliberately tiny: it only reads the `filename` element and
/// the `img_offset`/`len` attributes of each `byte_run`, and it never trusts
/// anything outside those values.
fn parse_report(path: &Path) -> BTreeMap<String, Vec<(u64, u64)>> {
    let mut runs = BTreeMap::new();
    let Ok(text) = fs::read_to_string(path) else {
        return runs;
    };
    for object in text.split("<fileobject>").skip(1) {
        let object = object.split("</fileobject>").next().unwrap_or_default();
        let Some(name) = element_text(object, "filename") else {
            continue;
        };
        let base = name.rsplit(['/', '\\']).next().unwrap_or(name).to_owned();
        let mut byte_runs = Vec::new();
        for run in object.split("<byte_run").skip(1) {
            let run = run.split("/>").next().unwrap_or_default();
            if let (Some(offset), Some(length)) =
                (attribute(run, "img_offset"), attribute(run, "len"))
            {
                byte_runs.push((offset, length));
            }
        }
        runs.insert(base, byte_runs);
    }
    runs
}

fn element_text<'a>(haystack: &'a str, element: &str) -> Option<&'a str> {
    let open = format!("<{element}>");
    let close = format!("</{element}>");
    let start = haystack.find(&open)? + open.len();
    let end = haystack[start..].find(&close)? + start;
    Some(haystack[start..end].trim())
}

fn attribute(haystack: &str, name: &str) -> Option<u64> {
    let key = format!("{name}=");
    let start = haystack.find(&key)? + key.len();
    let rest = &haystack[start..];
    let quote = rest.chars().next()?;
    if quote != '\'' && quote != '"' {
        return None;
    }
    let value = rest[1..].split(quote).next()?;
    value.parse().ok()
}
