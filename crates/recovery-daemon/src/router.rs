use carving::normalize_carved_file;
use case_store::{AuditEventInput, CaseInput, CaseStore};
use exporter::{ExportItem, ExportRequest, Exporter};
use image_io::RawImageReader;
use job_engine::{CheckpointStatus, JobEngine, JobStage};
use partition_scan::{PartitionScanResult, PartitionScanner};
use recovery_domain::{
    CapabilityLevel, PreviewStatus, RecoveryArtifact, RecoveryGoal, RuntimeMode, ScanPreset,
    SourceRange, ThreatStatus,
};
use recovery_ipc::{RpcErrorBody, RpcFrame, RpcRequest};
use reporting::{ExportRecord, RecoveryReportManifest, ToolRecord, generate_report};
use result_index::{ArtifactIndex, ArtifactQuery, ArtifactRow};
use safety_policy::{AssessmentResult, Decision, SafetyPolicy, SourceScenario};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use source_inventory::{ImageSource, SourceInventory};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use threat_scan::ThreatScanner;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;
use validation::{SafePreviewKind, ValidatorRegistry};

const DESTINATION_RESERVE_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCaseParams {
    title: String,
    operator: String,
    reference_number: Option<String>,
    organization: Option<String>,
    workspace_path: PathBuf,
    notes: Option<String>,
    estimated_required_bytes: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenCaseParams {
    case_path: PathBuf,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobParams {
    case_path: Option<PathBuf>,
    case_id: Option<Uuid>,
    source_id: String,
    goal: RecoveryGoal,
    preset: ScanPreset,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobParams {
    case_path: Option<PathBuf>,
    job_id: Uuid,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobEventsParams {
    case_path: Option<PathBuf>,
    job_id: Uuid,
    #[serde(default)]
    after_sequence: u64,
}

#[derive(Deserialize)]
struct AddImageParams {
    path: PathBuf,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceParams {
    source_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArtifactParams {
    artifact_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportParams {
    artifact_ids: Vec<String>,
    destination_path: PathBuf,
    destination_physical_id: String,
    #[serde(default)]
    acknowledge_unsafe: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReportParams {
    case_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityLimitation {
    code: String,
    stage: JobStage,
    level: CapabilityLevel,
    explanation: String,
    recommended_action: Option<String>,
}

#[derive(Default)]
struct DaemonState {
    current_case: Option<PathBuf>,
    sources: HashMap<String, ImageSource>,
    jobs: HashMap<Uuid, PathBuf>,
    latest_job: Option<Uuid>,
}

type RouteResult = Result<Value, (&'static str, String)>;
static DAEMON_STATE: OnceLock<Mutex<DaemonState>> = OnceLock::new();

pub fn route(request: &RpcRequest) -> RpcFrame {
    let mut state = match DAEMON_STATE
        .get_or_init(|| Mutex::new(DaemonState::default()))
        .lock()
    {
        Ok(state) => state,
        Err(error) => return error_frame(request, "DAEMON_STATE_FAILED", error.to_string()),
    };
    match state.handle(request) {
        Ok(result) => RpcFrame::Response {
            id: request.id,
            result,
        },
        Err((code, message)) => error_frame(request, code, message),
    }
}

impl DaemonState {
    fn handle(&mut self, request: &RpcRequest) -> RouteResult {
        match request.method.as_str() {
            "runtime.get" => Ok(json!({ "mode": runtime_mode() })),
            "case.create" => self.create_case(request),
            "case.open" => self.open_case(request),
            "source.list" => self.list_sources(),
            "source.add_image" => self.add_image(request),
            "source.assess" => self.assess_source(request),
            "job.create" => self.create_job(request),
            "job.start" | "job.pause" | "job.resume" | "job.cancel" => self.job_command(request),
            "job.status" => self.job_status(request),
            "job.events" => self.job_events(request),
            "artifact.query" => self.query_artifacts(request),
            "artifact.get" => self.get_artifact(request),
            "artifact.preview" => self.preview_artifact(request),
            "export.start" => self.export_artifacts(request),
            "report.generate" => self.generate_report(request),
            method => Err((
                "NOT_IMPLEMENTED",
                format!("{method} is not implemented yet"),
            )),
        }
    }

    fn create_case(&mut self, request: &RpcRequest) -> RouteResult {
        let params: CreateCaseParams = parse(request, "INVALID_CASE_INPUT")?;
        let destination_parent = params
            .workspace_path
            .parent()
            .unwrap_or(params.workspace_path.as_path());
        if let Ok(free) = fs2::available_space(destination_parent) {
            let required = params
                .estimated_required_bytes
                .unwrap_or(0)
                .saturating_add(DESTINATION_RESERVE_BYTES);
            if free < required {
                return Err((
                    "INSUFFICIENT_DESTINATION_SPACE",
                    format!(
                        "destination has {free} bytes available but {required} bytes are required"
                    ),
                ));
            }
        }
        let input = CaseInput {
            title: params.title,
            operator: params.operator.clone(),
            reference_number: params.reference_number,
            organization: params.organization,
            notes: params.notes,
        };
        let result = CaseStore::create(&params.workspace_path, input)
            .and_then(|mut store| {
                store.append_event(AuditEventInput {
                    event_type: "case.created".into(),
                    actor: params.operator,
                    payload: json!({ "source": "desktop" }),
                })?;
                serde_json::to_value(store.manifest()).map_err(case_store::CaseStoreError::from)
            })
            .map_err(|error| ("CASE_CREATE_FAILED", error.to_string()))?;
        self.current_case = Some(params.workspace_path);
        self.sources.clear();
        self.jobs.clear();
        self.latest_job = None;
        Ok(result)
    }

    fn open_case(&mut self, request: &RpcRequest) -> RouteResult {
        let params: OpenCaseParams = parse(request, "INVALID_CASE_INPUT")?;
        let store = CaseStore::open(&params.case_path)
            .map_err(|error| ("CASE_OPEN_FAILED", error.to_string()))?;
        self.current_case = Some(params.case_path.clone());
        self.sources = load_sources(&params.case_path);
        self.jobs = load_job_roots(&params.case_path);
        self.latest_job = self.jobs.keys().max().copied();
        serde_json::to_value(store.manifest())
            .map_err(|error| ("CASE_OPEN_FAILED", error.to_string()))
    }

    fn list_sources(&self) -> RouteResult {
        let mut sources = SourceInventory
            .list_physical_sources()
            .map_err(|error| ("SOURCE_INVENTORY_FAILED", error.to_string()))?;
        sources.extend(
            self.sources
                .values()
                .map(|source| source.descriptor.clone()),
        );
        serde_json::to_value(sources)
            .map_err(|error| ("SOURCE_INVENTORY_FAILED", error.to_string()))
    }

    fn add_image(&mut self, request: &RpcRequest) -> RouteResult {
        let params: AddImageParams = parse(request, "INVALID_IMAGE_INPUT")?;
        let root = self.active_case()?.to_path_buf();
        let source = SourceInventory
            .add_image(&params.path)
            .map_err(|error| ("IMAGE_SOURCE_FAILED", error.to_string()))?;
        write_json_atomic(
            &root
                .join("sources")
                .join(format!("{}.json", source.descriptor.source_id)),
            &source,
        )
        .map_err(|error| ("IMAGE_SOURCE_FAILED", error.to_string()))?;
        self.sources
            .insert(source.descriptor.source_id.clone(), source.clone());
        serde_json::to_value(source.descriptor)
            .map_err(|error| ("IMAGE_SOURCE_FAILED", error.to_string()))
    }

    fn assess_source(&self, request: &RpcRequest) -> RouteResult {
        let params: SourceParams = parse(request, "INVALID_SOURCE_INPUT")?;
        let assessment = self.assessment_for(&params.source_id, ScanPreset::Full)?;
        Ok(json!({
            "sourceId": params.source_id,
            "decision": assessment.decision,
            "requiresAcknowledgement": assessment.requires_acknowledgement,
            "findings": assessment.findings
        }))
    }

    fn create_job(&mut self, request: &RpcRequest) -> RouteResult {
        let params: CreateJobParams = parse(request, "INVALID_JOB_INPUT")?;
        let root = params
            .case_path
            .or_else(|| self.current_case.clone())
            .ok_or(("CASE_NOT_OPEN", "Open or create a case first".into()))?;
        let store =
            CaseStore::open(&root).map_err(|error| ("CASE_OPEN_FAILED", error.to_string()))?;
        let case_id = params.case_id.unwrap_or(store.manifest().case_id);
        if case_id != store.manifest().case_id {
            return Err((
                "CASE_ID_MISMATCH",
                "The requested case does not match the open case".into(),
            ));
        }
        if self
            .assessment_for(&params.source_id, params.preset)?
            .decision
            == Decision::Blocked
        {
            return Err((
                "SOURCE_BLOCKED",
                "The source assessment contains a hard safety block".into(),
            ));
        }
        let mut engine =
            JobEngine::open(&root).map_err(|error| ("JOB_CREATE_FAILED", error.to_string()))?;
        let job = engine
            .create_job(case_id, &params.source_id, params.goal, params.preset)
            .map_err(|error| ("JOB_CREATE_FAILED", error.to_string()))?;
        fs::create_dir_all(job_directory(&root, job.job_id))
            .map_err(|error| ("JOB_CREATE_FAILED", error.to_string()))?;
        self.jobs.insert(job.job_id, root);
        self.latest_job = Some(job.job_id);
        serde_json::to_value(job).map_err(|error| ("JOB_CREATE_FAILED", error.to_string()))
    }

    fn job_command(&mut self, request: &RpcRequest) -> RouteResult {
        let params: JobParams = parse(request, "INVALID_JOB_INPUT")?;
        let root = self.job_root(params.job_id, params.case_path.as_deref())?;
        if request.method == "job.start" {
            self.run_recovery(&root, params.job_id)?;
            return self.status_value(&root, params.job_id);
        }
        let mut engine =
            JobEngine::open(&root).map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
        let job = match request.method.as_str() {
            "job.pause" => engine.pause(params.job_id),
            "job.resume" => engine.resume(params.job_id),
            "job.cancel" => engine.cancel(params.job_id),
            _ => unreachable!(),
        }
        .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
        serde_json::to_value(job).map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))
    }

    fn job_status(&self, request: &RpcRequest) -> RouteResult {
        let params: JobParams = parse(request, "INVALID_JOB_INPUT")?;
        let root = self.job_root(params.job_id, params.case_path.as_deref())?;
        self.status_value(&root, params.job_id)
    }

    fn job_events(&self, request: &RpcRequest) -> RouteResult {
        let params: JobEventsParams = parse(request, "INVALID_JOB_INPUT")?;
        let root = self.job_root(params.job_id, params.case_path.as_deref())?;
        let engine =
            JobEngine::open(&root).map_err(|error| ("JOB_EVENTS_FAILED", error.to_string()))?;
        let events = engine
            .events_after(params.job_id, params.after_sequence)
            .map_err(|error| ("JOB_EVENTS_FAILED", error.to_string()))?;
        serde_json::to_value(events).map_err(|error| ("JOB_EVENTS_FAILED", error.to_string()))
    }

    fn query_artifacts(&self, request: &RpcRequest) -> RouteResult {
        let job_id = self.latest_job()?;
        let root = self.job_root(job_id, None)?;
        let query: ArtifactQuery = serde_json::from_value(request.params.clone())
            .map_err(|error| ("INVALID_ARTIFACT_QUERY", error.to_string()))?;
        let index = ArtifactIndex::open(&job_directory(&root, job_id).join("results.sqlite"))
            .map_err(|error| ("ARTIFACT_QUERY_FAILED", error.to_string()))?;
        let page = index
            .query(&query)
            .map_err(|error| ("ARTIFACT_QUERY_FAILED", error.to_string()))?;
        let by_id = load_artifacts(&root, job_id)?
            .into_iter()
            .map(|artifact| (artifact.artifact_id.clone(), artifact))
            .collect::<HashMap<_, _>>();
        let items = page
            .items
            .iter()
            .filter_map(|row| by_id.get(&row.artifact_id).cloned())
            .collect::<Vec<_>>();
        Ok(json!({ "items": items, "nextCursor": page.next_cursor }))
    }

    fn get_artifact(&self, request: &RpcRequest) -> RouteResult {
        let params: ArtifactParams = parse(request, "INVALID_ARTIFACT_INPUT")?;
        let artifact = self.find_artifact(&params.artifact_id)?.0;
        serde_json::to_value(artifact).map_err(|error| ("ARTIFACT_GET_FAILED", error.to_string()))
    }

    fn preview_artifact(&self, request: &RpcRequest) -> RouteResult {
        let params: ArtifactParams = parse(request, "INVALID_ARTIFACT_INPUT")?;
        let artifact = self.find_artifact(&params.artifact_id)?.0;
        let kind = match artifact.mime_type.as_deref() {
            Some("image/jpeg" | "image/png") => "sanitized_image",
            Some("application/pdf") => "rendered_pages",
            Some("text/plain") => "bounded_text",
            _ => "unsupported",
        };
        Ok(json!({
            "artifactId": artifact.artifact_id,
            "status": artifact.preview_status,
            "kind": kind,
            "mimeType": artifact.mime_type,
            "activeContent": false
        }))
    }

    fn export_artifacts(&self, request: &RpcRequest) -> RouteResult {
        let params: ExportParams = parse(request, "INVALID_EXPORT_INPUT")?;
        let job_id = self.latest_job()?;
        let root = self.job_root(job_id, None)?;
        let artifacts = load_artifacts(&root, job_id)?;
        let source_id = JobEngine::open(&root)
            .and_then(|engine| engine.snapshot(job_id))
            .map_err(|error| ("EXPORT_FAILED", error.to_string()))?
            .source_id;
        let source = self.source(&source_id)?;
        let mut items = Vec::new();
        for artifact_id in &params.artifact_ids {
            let artifact = artifacts
                .iter()
                .find(|artifact| &artifact.artifact_id == artifact_id)
                .ok_or((
                    "ARTIFACT_NOT_FOUND",
                    format!("artifact not found: {artifact_id}"),
                ))?;
            items.push(ExportItem {
                artifact_id: artifact.artifact_id.clone(),
                source_path: artifact_payload_path(&root, artifact),
                desired_path: export_name(artifact),
                expected_sha256: artifact.sha256.clone(),
                potentially_unsafe: artifact.threat_status == ThreatStatus::PotentialThreat
                    || artifact.preview_status == PreviewStatus::Blocked,
            });
        }
        let destination = params.destination_path.clone();
        let exported = run_export(ExportRequest {
            export_root: destination.clone(),
            source_physical_id: source.descriptor.stable_id.clone(),
            destination_physical_id: params.destination_physical_id,
            acknowledge_unsafe: params.acknowledge_unsafe,
            items,
        })
        .map_err(|error| ("EXPORT_FAILED", error))?;
        let export_id = Uuid::now_v7();
        let records = exported
            .iter()
            .map(|item| ExportRecord {
                artifact_id: item.artifact_id.clone(),
                relative_path: item
                    .output_path
                    .strip_prefix(&destination)
                    .unwrap_or(&item.output_path)
                    .to_string_lossy()
                    .into_owned(),
                sha256: item.sha256.clone(),
                verified: item.verified,
            })
            .collect::<Vec<_>>();
        write_json_atomic(
            &root.join("exports").join(format!("{export_id}.json")),
            &records,
        )
        .map_err(|error| ("EXPORT_FAILED", error.to_string()))?;
        let response_items = exported
            .iter()
            .map(|item| {
                json!({
                    "artifactId": item.artifact_id,
                    "outputPath": item.output_path,
                    "sha256": item.sha256,
                    "verified": item.verified
                })
            })
            .collect::<Vec<_>>();
        Ok(json!({ "exportId": export_id, "items": response_items }))
    }

    fn generate_report(&self, request: &RpcRequest) -> RouteResult {
        let params: ReportParams = parse(request, "INVALID_REPORT_INPUT")?;
        let job_id = self.latest_job()?;
        let root = self.job_root(job_id, None)?;
        let store = CaseStore::open(&root).map_err(|error| ("REPORT_FAILED", error.to_string()))?;
        if store.manifest().case_id != params.case_id {
            return Err(("CASE_ID_MISMATCH", "The requested case is not open".into()));
        }
        let snapshot = JobEngine::open(&root)
            .and_then(|engine| engine.snapshot(job_id))
            .map_err(|error| ("REPORT_FAILED", error.to_string()))?;
        let source = self.source(&snapshot.source_id)?;
        let hash_before: String = read_json(&job_directory(&root, job_id).join("source-hash.json"))
            .map_err(|error| ("REPORT_FAILED", error.to_string()))?;
        let hash_after = sha256_file(&source.canonical_path)
            .map_err(|error| ("REPORT_FAILED", error.to_string()))?;
        let artifacts = load_artifacts(&root, job_id)?;
        let limitations = load_limitations(&root, job_id)?;
        let mut method_counts = BTreeMap::new();
        let mut quality_counts = BTreeMap::new();
        for artifact in &artifacts {
            *method_counts
                .entry(serialized_name(artifact.recovery_method))
                .or_insert(0) += 1;
            *quality_counts
                .entry(serialized_name(artifact.recovery_state))
                .or_insert(0) += 1;
        }
        let manifest = RecoveryReportManifest {
            schema_version: 1,
            case_id: params.case_id.to_string(),
            source_id: snapshot.source_id,
            source_geometry: format!(
                "{} bytes; {}-byte logical sectors",
                source.descriptor.size_bytes,
                source.descriptor.logical_sector_size.unwrap_or(512)
            ),
            source_hash_before: Some(hash_before),
            source_hash_after: Some(hash_after),
            tools: vec![
                tool_record("partition-scan-built-in"),
                tool_record("signature-carver-built-in"),
                ToolRecord {
                    id: "yara-x-adapter".into(),
                    version: "1".into(),
                },
            ],
            method_counts,
            quality_counts,
            warnings: Vec::new(),
            unreadable_ranges: Vec::new(),
            export_manifest: load_export_records(&root),
            limitations: limitations
                .iter()
                .map(|item| format!("{}: {}", item.code, item.explanation))
                .collect(),
            signature: None,
        };
        let generated =
            generate_report(&manifest).map_err(|error| ("REPORT_FAILED", error.to_string()))?;
        let base = root
            .join("reports")
            .join(format!("{}-recovery-report", params.case_id));
        let json_path = base.with_extension("json");
        let markdown_path = base.with_extension("md");
        write_atomic(&json_path, generated.json.as_bytes())
            .map_err(|error| ("REPORT_FAILED", error.to_string()))?;
        write_atomic(&markdown_path, generated.markdown.as_bytes())
            .map_err(|error| ("REPORT_FAILED", error.to_string()))?;
        Ok(json!({
            "caseId": params.case_id,
            "jsonPath": json_path,
            "markdownPath": markdown_path,
            "limitations": limitations
        }))
    }

    fn run_recovery(&self, root: &Path, job_id: Uuid) -> RouteResult {
        let mut engine =
            JobEngine::open(root).map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
        let snapshot = engine
            .start(job_id)
            .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
        let source = self.source(&snapshot.source_id)?.clone();
        let assessment = self.assessment_for(&snapshot.source_id, snapshot.preset)?;
        if assessment.decision == Decision::Blocked {
            checkpoint(
                &mut engine,
                job_id,
                JobStage::NeedsAttention,
                0,
                json!({ "assessment": assessment }),
                "PREFLIGHT_FAILED",
            )?;
            return self.status_value(root, job_id);
        }
        let source_hash = sha256_file(&source.canonical_path)
            .map_err(|error| ("PREFLIGHT_FAILED", error.to_string()))?;
        write_json_atomic(
            &job_directory(root, job_id).join("source-hash.json"),
            &source_hash,
        )
        .map_err(|error| ("PREFLIGHT_FAILED", error.to_string()))?;
        checkpoint(
            &mut engine,
            job_id,
            JobStage::Preflight,
            source.descriptor.size_bytes,
            json!({ "assessment": assessment, "sourceHash": source_hash }),
            "PREFLIGHT_FAILED",
        )?;

        let partitions = scan_partitions(source.canonical_path.clone())
            .map_err(|error| ("PARTITION_SCAN_FAILED", error))?;
        write_json_atomic(
            &job_directory(root, job_id).join("partitions.json"),
            &partitions,
        )
        .map_err(|error| ("PARTITION_SCAN_FAILED", error.to_string()))?;
        checkpoint(
            &mut engine,
            job_id,
            JobStage::PartitionScan,
            source.descriptor.size_bytes,
            serde_json::to_value(&partitions).unwrap_or_default(),
            "PARTITION_SCAN_FAILED",
        )?;

        let mut limitations = vec![limitation(
            "TSK_METADATA_UNAVAILABLE",
            JobStage::MetadataScan,
            "Sleuth Kit metadata recovery is not available in the current verified tool catalog.",
            "Install and verify Sleuth Kit to recover surviving original names and paths.",
        )];
        checkpoint(
            &mut engine,
            job_id,
            JobStage::MetadataScan,
            0,
            json!({ "limitations": limitations }),
            "METADATA_SCAN_FAILED",
        )?;
        if !permits_raw_carving(snapshot.goal) {
            write_json_atomic(
                &job_directory(root, job_id).join("limitations.json"),
                &limitations,
            )
            .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
            checkpoint(
                &mut engine,
                job_id,
                JobStage::NeedsAttention,
                0,
                json!({ "reason": "metadata_engine_unavailable" }),
                "JOB_COMMAND_FAILED",
            )?;
            return self.status_value(root, job_id);
        }

        limitations.push(limitation(
            "PHOTOREC_UNAVAILABLE",
            JobStage::Carving,
            "PhotoRec is unavailable; the built-in bounded JPEG signature engine was used.",
            "Install and verify PhotoRec for broader content-signature coverage.",
        ));
        write_json_atomic(
            &job_directory(root, job_id).join("limitations.json"),
            &limitations,
        )
        .map_err(|error| ("CARVING_FAILED", error.to_string()))?;
        let mut artifacts = carve_jpegs(root, job_id, &source)?;
        checkpoint(
            &mut engine,
            job_id,
            JobStage::Carving,
            source.descriptor.size_bytes,
            json!({ "artifactCount": artifacts.len(), "limitations": limitations }),
            "CARVING_FAILED",
        )?;

        validate_artifacts(root, &mut artifacts)?;
        checkpoint(
            &mut engine,
            job_id,
            JobStage::Validating,
            artifacts.len() as u64,
            json!({ "artifactCount": artifacts.len() }),
            "VALIDATION_FAILED",
        )?;
        threat_scan_artifacts(root, &mut artifacts)?;
        checkpoint(
            &mut engine,
            job_id,
            JobStage::ThreatScan,
            artifacts.len() as u64,
            json!({ "artifactCount": artifacts.len() }),
            "THREAT_SCAN_FAILED",
        )?;

        write_json_atomic(
            &job_directory(root, job_id).join("artifacts.json"),
            &artifacts,
        )
        .map_err(|error| ("INDEXING_FAILED", error.to_string()))?;
        index_artifacts(root, job_id, &artifacts)?;
        for stage in [
            JobStage::Indexing,
            JobStage::ReviewReady,
            JobStage::Completed,
        ] {
            checkpoint(
                &mut engine,
                job_id,
                stage,
                artifacts.len() as u64,
                json!({ "artifactCount": artifacts.len() }),
                "JOB_COMMAND_FAILED",
            )?;
        }
        self.status_value(root, job_id)
    }

    fn assessment_for(
        &self,
        source_id: &str,
        preset: ScanPreset,
    ) -> Result<AssessmentResult, (&'static str, String)> {
        let source = self.source(source_id)?;
        let current = SourceInventory
            .add_image(&source.canonical_path)
            .map_err(|error| ("SOURCE_ASSESSMENT_FAILED", error.to_string()))?;
        Ok(SafetyPolicy.assess_source(
            SourceScenario {
                identity_changed: current.descriptor.stable_id != source.descriptor.stable_id,
                requires_write: false,
                system_disk: source.descriptor.system_disk,
                encrypted_state: source.descriptor.encrypted_state,
                health: source.descriptor.health,
                experimental_filesystem: false,
                unsupported: !source.findings.is_empty(),
            },
            preset,
            runtime_mode(),
        ))
    }

    fn status_value(&self, root: &Path, job_id: Uuid) -> RouteResult {
        let snapshot = JobEngine::open(root)
            .and_then(|engine| engine.snapshot(job_id))
            .map_err(|error| ("JOB_STATUS_FAILED", error.to_string()))?;
        let mut value = serde_json::to_value(snapshot)
            .map_err(|error| ("JOB_STATUS_FAILED", error.to_string()))?;
        value["limitations"] = serde_json::to_value(load_limitations(root, job_id)?)
            .map_err(|error| ("JOB_STATUS_FAILED", error.to_string()))?;
        Ok(value)
    }

    fn find_artifact(
        &self,
        artifact_id: &str,
    ) -> Result<(RecoveryArtifact, PathBuf), (&'static str, String)> {
        let job_id = self.latest_job()?;
        let root = self.job_root(job_id, None)?;
        let artifact = load_artifacts(&root, job_id)?
            .into_iter()
            .find(|artifact| artifact.artifact_id == artifact_id)
            .ok_or((
                "ARTIFACT_NOT_FOUND",
                format!("artifact not found: {artifact_id}"),
            ))?;
        Ok((artifact, root))
    }

    fn source(&self, source_id: &str) -> Result<&ImageSource, (&'static str, String)> {
        self.sources
            .get(source_id)
            .ok_or(("SOURCE_NOT_FOUND", format!("source not found: {source_id}")))
    }

    fn active_case(&self) -> Result<&Path, (&'static str, String)> {
        self.current_case
            .as_deref()
            .ok_or(("CASE_NOT_OPEN", "Open or create a case first".into()))
    }

    fn latest_job(&self) -> Result<Uuid, (&'static str, String)> {
        self.latest_job
            .ok_or(("JOB_NOT_FOUND", "No recovery job is active".into()))
    }

    fn job_root(
        &self,
        job_id: Uuid,
        requested: Option<&Path>,
    ) -> Result<PathBuf, (&'static str, String)> {
        requested
            .map(Path::to_path_buf)
            .or_else(|| self.jobs.get(&job_id).cloned())
            .or_else(|| self.current_case.clone())
            .ok_or(("JOB_NOT_FOUND", format!("job not found: {job_id}")))
    }
}

fn carve_jpegs(
    root: &Path,
    job_id: Uuid,
    source: &ImageSource,
) -> Result<Vec<RecoveryArtifact>, (&'static str, String)> {
    let bytes =
        fs::read(&source.canonical_path).map_err(|error| ("CARVING_FAILED", error.to_string()))?;
    let carved = job_directory(root, job_id).join("carved");
    fs::create_dir_all(&carved).map_err(|error| ("CARVING_FAILED", error.to_string()))?;
    let mut artifacts = Vec::new();
    let mut cursor = 0;
    while cursor + 3 <= bytes.len() {
        let Some(relative_start) = bytes[cursor..]
            .windows(3)
            .position(|window| window == [0xff, 0xd8, 0xff])
        else {
            break;
        };
        let start = cursor + relative_start;
        let Some(relative_end) = bytes[start + 3..]
            .windows(2)
            .position(|window| window == [0xff, 0xd9])
        else {
            break;
        };
        let end = start + 3 + relative_end + 2;
        let path = carved.join(format!("f{:07}.jpg", artifacts.len() + 1));
        fs::write(&path, &bytes[start..end])
            .map_err(|error| ("CARVING_FAILED", error.to_string()))?;
        let mut artifact = normalize_carved_file(&source.descriptor.source_id, &path, "jpeg")
            .map_err(|error| ("CARVING_FAILED", error.to_string()))?;
        artifact.source_ranges = vec![SourceRange {
            offset: start as u64,
            length: (end - start) as u64,
        }];
        fs::copy(&path, artifact_payload_path(root, &artifact))
            .map_err(|error| ("CARVING_FAILED", error.to_string()))?;
        artifacts.push(artifact);
        cursor = end;
    }
    Ok(artifacts)
}

fn validate_artifacts(
    root: &Path,
    artifacts: &mut [RecoveryArtifact],
) -> Result<(), (&'static str, String)> {
    for artifact in artifacts {
        let outcome = ValidatorRegistry::default()
            .validate(&artifact_payload_path(root, artifact), Default::default())
            .map_err(|error| ("VALIDATION_FAILED", error.to_string()))?;
        artifact.recovery_state = outcome.state;
        artifact.mime_type = outcome.detected_type;
        artifact.preview_status = match outcome.safe_preview_kind {
            SafePreviewKind::SanitizedImage
            | SafePreviewKind::PdfPages
            | SafePreviewKind::BoundedText => PreviewStatus::SafePreview,
            SafePreviewKind::MetadataOnly => PreviewStatus::Unsupported,
            SafePreviewKind::Blocked => PreviewStatus::Blocked,
        };
    }
    Ok(())
}

fn threat_scan_artifacts(
    root: &Path,
    artifacts: &mut [RecoveryArtifact],
) -> Result<(), (&'static str, String)> {
    for artifact in artifacts {
        let outcome = ThreatScanner::default()
            .scan(&artifact_payload_path(root, artifact))
            .map_err(|error| ("THREAT_SCAN_FAILED", error.to_string()))?;
        artifact.threat_status = outcome.status;
        if outcome.status == ThreatStatus::PotentialThreat {
            artifact.preview_status = PreviewStatus::Blocked;
        }
    }
    Ok(())
}

fn index_artifacts(
    root: &Path,
    job_id: Uuid,
    artifacts: &[RecoveryArtifact],
) -> Result<(), (&'static str, String)> {
    let mut index = ArtifactIndex::open(&job_directory(root, job_id).join("results.sqlite"))
        .map_err(|error| ("INDEXING_FAILED", error.to_string()))?;
    let rows = artifacts
        .iter()
        .map(|artifact| ArtifactRow {
            artifact_id: artifact.artifact_id.clone(),
            original_name: artifact.original_name.clone(),
            original_path: artifact.original_path.clone(),
            mime_type: artifact.mime_type.clone(),
            method: serialized_name(artifact.recovery_method),
            status: serialized_name(artifact.recovery_state),
            threat: serialized_name(artifact.threat_status),
            size_bytes: artifact.size_bytes,
            partition_id: artifact.partition_id.clone(),
        })
        .collect::<Vec<_>>();
    index
        .insert_batch(&rows)
        .map_err(|error| ("INDEXING_FAILED", error.to_string()))
}

fn scan_partitions(path: PathBuf) -> Result<PartitionScanResult, String> {
    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| error.to_string())?;
        runtime.block_on(async move {
            let reader = RawImageReader::open(&path)
                .await
                .map_err(|error| error.to_string())?;
            PartitionScanner::default()
                .scan(&reader)
                .await
                .map_err(|error| error.to_string())
        })
    })
    .join()
    .map_err(|_| "partition scan worker panicked".to_owned())?
}

fn run_export(request: ExportRequest) -> Result<Vec<exporter::ExportVerification>, String> {
    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| error.to_string())?;
        runtime.block_on(async move {
            Exporter
                .export(request, CancellationToken::new())
                .await
                .map_err(|error| error.to_string())
        })
    })
    .join()
    .map_err(|_| "export worker panicked".to_owned())?
}

fn checkpoint(
    engine: &mut JobEngine,
    job_id: Uuid,
    stage: JobStage,
    progress: u64,
    continuation: Value,
    code: &'static str,
) -> Result<(), (&'static str, String)> {
    engine
        .checkpoint(
            job_id,
            stage,
            CheckpointStatus::Completed,
            progress,
            continuation,
        )
        .map(|_| ())
        .map_err(|error| (code, error.to_string()))
}

fn load_sources(root: &Path) -> HashMap<String, ImageSource> {
    let mut sources = HashMap::new();
    if let Ok(entries) = fs::read_dir(root.join("sources")) {
        for entry in entries.flatten() {
            if let Ok(source) = read_json::<ImageSource>(&entry.path()) {
                sources.insert(source.descriptor.source_id.clone(), source);
            }
        }
    }
    sources
}

fn load_job_roots(root: &Path) -> HashMap<Uuid, PathBuf> {
    let mut jobs = HashMap::new();
    if let Ok(entries) = fs::read_dir(root.join("work")) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str()
                && let Ok(job_id) = Uuid::parse_str(name)
            {
                jobs.insert(job_id, root.to_path_buf());
            }
        }
    }
    jobs
}

fn load_artifacts(
    root: &Path,
    job_id: Uuid,
) -> Result<Vec<RecoveryArtifact>, (&'static str, String)> {
    read_json(&job_directory(root, job_id).join("artifacts.json"))
        .map_err(|error| ("ARTIFACT_STORE_FAILED", error.to_string()))
}

fn load_limitations(
    root: &Path,
    job_id: Uuid,
) -> Result<Vec<CapabilityLimitation>, (&'static str, String)> {
    let path = job_directory(root, job_id).join("limitations.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    read_json(&path).map_err(|error| ("JOB_STATUS_FAILED", error.to_string()))
}

fn load_export_records(root: &Path) -> Vec<ExportRecord> {
    let mut records = Vec::new();
    if let Ok(entries) = fs::read_dir(root.join("exports")) {
        for entry in entries.flatten() {
            if let Ok(mut stored) = read_json::<Vec<ExportRecord>>(&entry.path()) {
                records.append(&mut stored);
            }
        }
    }
    records
}

fn limitation(
    code: &str,
    stage: JobStage,
    explanation: &str,
    action: &str,
) -> CapabilityLimitation {
    CapabilityLimitation {
        code: code.into(),
        stage,
        level: CapabilityLevel::Limited,
        explanation: explanation.into(),
        recommended_action: Some(action.into()),
    }
}

fn permits_raw_carving(goal: RecoveryGoal) -> bool {
    matches!(
        goal,
        RecoveryGoal::RecoverEverything | RecoveryGoal::PartitionLoss | RecoveryGoal::DamagedDevice
    )
}

fn runtime_mode() -> RuntimeMode {
    if std::env::var("RECOVERY_RUNTIME_MODE").as_deref() == Ok("rescue") {
        RuntimeMode::Rescue
    } else {
        RuntimeMode::Installed
    }
}

fn artifact_payload_path(root: &Path, artifact: &RecoveryArtifact) -> PathBuf {
    root.join("recovered").join("quarantine").join(format!(
        "{}.{}",
        artifact.artifact_id,
        artifact.extension.as_deref().unwrap_or("bin")
    ))
}

fn export_name(artifact: &RecoveryArtifact) -> String {
    if let Some(path) = &artifact.original_path {
        return path.trim_start_matches(['/', '\\']).to_owned();
    }
    artifact
        .extension
        .as_ref()
        .map(|extension| format!("{}.{}", artifact.display_name, extension))
        .unwrap_or_else(|| artifact.display_name.clone())
}

fn job_directory(root: &Path, job_id: Uuid) -> PathBuf {
    root.join("work").join(job_id.to_string())
}

fn serialized_name<T: Serialize>(value: T) -> String {
    serde_json::to_value(value)
        .ok()
        .and_then(|value| value.as_str().map(str::to_owned))
        .unwrap_or_else(|| "unknown".into())
}

fn tool_record(id: &str) -> ToolRecord {
    ToolRecord {
        id: id.into(),
        version: env!("CARGO_PKG_VERSION").into(),
    }
}

fn sha256_file(path: &Path) -> std::io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn write_json_atomic(path: &Path, value: &impl Serialize) -> std::io::Result<()> {
    write_atomic(
        path,
        &serde_json::to_vec_pretty(value).map_err(std::io::Error::other)?,
    )
}

fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension(format!(
        "{}.tmp",
        path.extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
    ));
    fs::write(&temporary, bytes)?;
    fs::rename(temporary, path)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> std::io::Result<T> {
    serde_json::from_slice(&fs::read(path)?).map_err(std::io::Error::other)
}

fn parse<T: for<'de> Deserialize<'de>>(
    request: &RpcRequest,
    code: &'static str,
) -> Result<T, (&'static str, String)> {
    serde_json::from_value(request.params.clone()).map_err(|error| (code, error.to_string()))
}

fn error_frame(request: &RpcRequest, code: &str, message: String) -> RpcFrame {
    RpcFrame::Error {
        id: request.id,
        error: RpcErrorBody {
            code: code.into(),
            message,
        },
    }
}
