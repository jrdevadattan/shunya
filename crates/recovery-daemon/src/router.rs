use carving::normalize_carved_file;
use case_store::{AuditEventInput, CaseInput, CaseStore};
use exporter::{ExportItem, ExportRequest, Exporter};
use image_io::RawImageReader;
use job_engine::{CheckpointStatus, JobEngine, JobSnapshot, JobStage};
use partition_scan::{PartitionScanResult, PartitionScanner};
use recovery_domain::{
    CapabilityLevel, PreviewStatus, RecoveryArtifact, RecoveryGoal, RecoveryState, RuntimeMode,
    ScanPreset, SourceRange, ThreatStatus,
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
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::JoinHandle;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;
use validation::ValidatorRegistry;

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
#[serde(deny_unknown_fields)]
struct ExportParams {
    artifact_ids: Vec<String>,
    destination_path: PathBuf,
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
    latest_source: Option<String>,
    jobs: HashMap<Uuid, PathBuf>,
    latest_job: Option<Uuid>,
    controls: HashMap<Uuid, Arc<JobControl>>,
}

const CONTROL_RUNNING: u8 = 0;
const CONTROL_PAUSE: u8 = 1;
const CONTROL_CANCEL: u8 = 2;

struct JobControl {
    requested: AtomicU8,
    checkpoint_gate: Mutex<()>,
    worker: Mutex<Option<JoinHandle<()>>>,
}

impl JobControl {
    fn new() -> Self {
        Self {
            requested: AtomicU8::new(CONTROL_RUNNING),
            checkpoint_gate: Mutex::new(()),
            worker: Mutex::new(None),
        }
    }

    fn request(&self, request: u8) {
        self.requested.store(request, Ordering::SeqCst);
    }

    fn requested(&self) -> u8 {
        self.requested.load(Ordering::SeqCst)
    }

    fn join(&self) {
        if let Some(worker) = self.worker.lock().expect("worker lock").take() {
            let _ = worker.join();
        }
    }

    fn is_active(&self) -> bool {
        self.worker
            .lock()
            .expect("worker lock")
            .as_ref()
            .is_some_and(|worker| !worker.is_finished())
    }
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
            "case.state" => self.case_state(),
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
        self.ensure_case_switch_allowed()?;
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
        self.latest_source = None;
        self.jobs.clear();
        self.latest_job = None;
        self.controls.clear();
        Ok(result)
    }

    fn open_case(&mut self, request: &RpcRequest) -> RouteResult {
        let params: OpenCaseParams = parse(request, "INVALID_CASE_INPUT")?;
        if self.current_case.as_deref() == Some(params.case_path.as_path())
            && self.controls.values().any(|control| control.is_active())
        {
            let store = CaseStore::open(&params.case_path)
                .map_err(|error| ("CASE_OPEN_FAILED", error.to_string()))?;
            return serde_json::to_value(store.manifest())
                .map_err(|error| ("CASE_OPEN_FAILED", error.to_string()));
        }
        self.ensure_case_switch_allowed()?;
        let store = CaseStore::open(&params.case_path)
            .map_err(|error| ("CASE_OPEN_FAILED", error.to_string()))?;
        self.current_case = Some(params.case_path.clone());
        let (sources, latest_source) = load_sources(&params.case_path);
        self.sources = sources;
        self.latest_source = latest_source;
        self.jobs = load_job_roots(&params.case_path);
        self.latest_job = self.jobs.keys().max().copied();
        self.controls.clear();
        JobEngine::open(&params.case_path)
            .and_then(|mut engine| engine.recover_incomplete_jobs())
            .map_err(|error| ("JOB_RECOVERY_FAILED", error.to_string()))?;
        serde_json::to_value(store.manifest())
            .map_err(|error| ("CASE_OPEN_FAILED", error.to_string()))
    }

    fn case_state(&self) -> RouteResult {
        let source_id = if let Some(job_id) = self.latest_job {
            let root = self.job_root(job_id, None)?;
            let snapshot = JobEngine::open(&root)
                .and_then(|engine| engine.snapshot(job_id))
                .map_err(|error| ("CASE_STATE_FAILED", error.to_string()))?;
            Some(snapshot.source_id)
        } else {
            self.latest_source.clone()
        };
        if let Some(source_id) = source_id.as_deref() {
            self.source(source_id)?;
        }
        Ok(json!({ "sourceId": source_id, "latestJobId": self.latest_job }))
    }

    fn ensure_case_switch_allowed(&self) -> Result<(), (&'static str, String)> {
        if self.controls.values().any(|control| control.is_active()) {
            return Err((
                "CASE_BUSY",
                "Pause or cancel the active recovery job before changing cases".into(),
            ));
        }
        Ok(())
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
        self.latest_source = Some(source.descriptor.source_id.clone());
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
        let mut engine =
            JobEngine::open(&root).map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
        match request.method.as_str() {
            "job.start" => {
                let job = engine
                    .start(params.job_id)
                    .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                engine
                    .checkpoint(
                        params.job_id,
                        JobStage::Preflight,
                        CheckpointStatus::InProgress,
                        0,
                        json!({ "phase": "source_revalidation" }),
                    )
                    .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                let source = self.source(&job.source_id)?.clone();
                self.spawn_job(root.clone(), job, source);
                self.status_value(&root, params.job_id)
            }
            "job.resume" => {
                let job = engine
                    .resume(params.job_id)
                    .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                engine
                    .checkpoint(
                        params.job_id,
                        job.stage,
                        CheckpointStatus::InProgress,
                        0,
                        json!({ "phase": "resuming" }),
                    )
                    .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                let source = self.source(&job.source_id)?.clone();
                self.spawn_job(root.clone(), job, source);
                self.status_value(&root, params.job_id)
            }
            "job.pause" => {
                let control = self.controls.get(&params.job_id).cloned().ok_or((
                    "JOB_NOT_RUNNING",
                    "The recovery job has no active worker".into(),
                ))?;
                control.request(CONTROL_PAUSE);
                {
                    let _gate = control.checkpoint_gate.lock().expect("checkpoint gate");
                    let current = engine
                        .snapshot(params.job_id)
                        .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                    if !matches!(
                        current.stage,
                        JobStage::Completed | JobStage::Cancelled | JobStage::Failed
                    ) {
                        engine
                            .pause(params.job_id)
                            .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                    }
                }
                control.join();
                self.status_value(&root, params.job_id)
            }
            "job.cancel" => {
                let control = self.controls.get(&params.job_id).cloned();
                if let Some(control) = &control {
                    control.request(CONTROL_CANCEL);
                    let _gate = control.checkpoint_gate.lock().expect("checkpoint gate");
                    let current = engine
                        .snapshot(params.job_id)
                        .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                    if !matches!(
                        current.stage,
                        JobStage::Completed | JobStage::Cancelled | JobStage::Failed
                    ) {
                        engine
                            .cancel(params.job_id)
                            .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                    }
                } else {
                    engine
                        .cancel(params.job_id)
                        .map_err(|error| ("JOB_COMMAND_FAILED", error.to_string()))?;
                }
                if let Some(control) = control {
                    control.join();
                }
                self.status_value(&root, params.job_id)
            }
            _ => unreachable!(),
        }
    }

    fn spawn_job(&mut self, root: PathBuf, job: JobSnapshot, source: ImageSource) {
        let job_id = job.job_id;
        let control = Arc::new(JobControl::new());
        let worker_control = Arc::clone(&control);
        let worker_root = root.clone();
        let worker = std::thread::spawn(move || {
            if let Err(failure) = run_recovery_worker(&worker_root, &job, &source, &worker_control)
            {
                persist_worker_failure(&worker_root, job.job_id, &worker_control, failure);
            }
        });
        *control.worker.lock().expect("worker lock") = Some(worker);
        self.controls.insert(job_id, control);
        self.jobs.insert(job_id, root);
        self.latest_job = Some(job_id);
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
        let total_count = index
            .count(&query)
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
        Ok(json!({ "items": items, "nextCursor": page.next_cursor, "totalCount": total_count }))
    }

    fn get_artifact(&self, request: &RpcRequest) -> RouteResult {
        let params: ArtifactParams = parse(request, "INVALID_ARTIFACT_INPUT")?;
        let artifact = self.find_artifact(&params.artifact_id)?.0;
        serde_json::to_value(artifact).map_err(|error| ("ARTIFACT_GET_FAILED", error.to_string()))
    }

    fn preview_artifact(&self, request: &RpcRequest) -> RouteResult {
        let params: ArtifactParams = parse(request, "INVALID_ARTIFACT_INPUT")?;
        let artifact = self.find_artifact(&params.artifact_id)?.0;
        let active_or_unsupported = is_active_or_unsupported(&artifact);
        let (status, policy) =
            if artifact.threat_status == ThreatStatus::PotentialThreat || active_or_unsupported {
                (PreviewStatus::Blocked, "active_or_unsupported_content")
            } else {
                (PreviewStatus::Unsupported, "derivative_required")
            };
        Ok(json!({
            "artifactId": artifact.artifact_id,
            "status": status,
            "policy": policy,
            "detectedMimeType": artifact.mime_type,
            "derivativePath": null
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
            if artifact.recovery_state != RecoveryState::CompleteValidated {
                return Err((
                    "EXPORT_SELECTION_NOT_VERIFIED",
                    format!(
                        "verified export requires complete_validated artifacts; {} is {:?}",
                        artifact.artifact_id, artifact.recovery_state
                    ),
                ));
            }
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
        let source_device = physical_device_evidence(&source.canonical_path)
            .map_err(|error| ("EXPORT_DESTINATION_UNVERIFIED", error.to_string()))?;
        let destination_device = physical_device_evidence(&destination)
            .map_err(|error| ("EXPORT_DESTINATION_UNVERIFIED", error.to_string()))?;
        let (source_physical_id, destination_physical_id) = validate_export_destination(
            &source.canonical_path,
            &root,
            &destination,
            &source_device,
            &destination_device,
        )?;
        let exported = run_export(ExportRequest {
            export_root: destination.clone(),
            source_physical_id,
            destination_physical_id,
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
        let partitions_path = job_directory(root, job_id).join("partitions.json");
        value["partitions"] = if partitions_path.exists() {
            partition_status_value(
                read_json::<PartitionScanResult>(&partitions_path)
                    .map_err(|error| ("JOB_STATUS_FAILED", error.to_string()))?,
            )
        } else {
            Value::Null
        };
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

fn partition_status_value(result: PartitionScanResult) -> Value {
    json!({
        "sectorSize": result.sector_size,
        "partitions": result.partitions.into_iter().map(|partition| json!({
            "partitionId": partition.partition_id,
            "index": partition.index,
            "startSector": partition.start_sector.to_string(),
            "sectorCount": partition.sector_count.to_string(),
            "startOffsetBytes": partition.start_offset_bytes.to_string(),
            "lengthBytes": partition.length_bytes.to_string(),
            "partitionType": partition.partition_type,
            "filesystem": partition.filesystem,
            "label": partition.label,
        })).collect::<Vec<_>>(),
        "candidates": result.candidates.into_iter().map(|candidate| json!({
            "startSector": candidate.start_sector.to_string(),
            "startOffsetBytes": candidate.start_offset_bytes.to_string(),
            "filesystem": candidate.filesystem,
            "confidence": candidate.confidence,
            "source": candidate.source,
        })).collect::<Vec<_>>(),
        "gaps": result.gaps.into_iter().map(|(offset, length)| json!([offset.to_string(), length.to_string()])).collect::<Vec<_>>(),
        "rawToolOutput": result.raw_tool_output,
        "toolVersion": result.tool_version,
    })
}

struct WorkerFailure {
    stage: JobStage,
    code: &'static str,
    message: String,
    needs_attention: bool,
}

impl WorkerFailure {
    fn attention(stage: JobStage, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            stage,
            code,
            message: message.into(),
            needs_attention: true,
        }
    }

    fn failed(stage: JobStage, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            stage,
            code,
            message: message.into(),
            needs_attention: false,
        }
    }
}

fn run_recovery_worker(
    root: &Path,
    job: &JobSnapshot,
    source: &ImageSource,
    control: &JobControl,
) -> Result<(), WorkerFailure> {
    let mut engine = JobEngine::open(root).map_err(|error| {
        WorkerFailure::failed(JobStage::Preflight, "JOB_OPEN_FAILED", error.to_string())
    })?;
    let job_id = job.job_id;

    if !stage_completed(&engine, job_id, JobStage::Preflight)? {
        if !begin_stage(&mut engine, job_id, JobStage::Preflight, control)? {
            return Ok(());
        }
        let current = SourceInventory
            .add_image(&source.canonical_path)
            .map_err(|error| {
                WorkerFailure::attention(
                    JobStage::Preflight,
                    "SOURCE_REVALIDATION_FAILED",
                    error.to_string(),
                )
            })?;
        let assessment = SafetyPolicy.assess_source(
            SourceScenario {
                identity_changed: current.descriptor.stable_id != source.descriptor.stable_id,
                requires_write: false,
                system_disk: source.descriptor.system_disk,
                encrypted_state: source.descriptor.encrypted_state,
                health: source.descriptor.health,
                experimental_filesystem: false,
                unsupported: !source.findings.is_empty(),
            },
            job.preset,
            runtime_mode(),
        );
        if assessment.decision == Decision::Blocked {
            return Err(WorkerFailure::attention(
                JobStage::Preflight,
                "SOURCE_BLOCKED",
                "Source revalidation returned a safety block",
            ));
        }
        let source_hash =
            controlled_sha256_file(&source.canonical_path, control).map_err(|error| {
                WorkerFailure::attention(
                    JobStage::Preflight,
                    "SOURCE_READ_FAILED",
                    error.to_string(),
                )
            })?;
        if control.requested() != CONTROL_RUNNING {
            return Ok(());
        }
        write_json_atomic(
            &job_directory(root, job_id).join("source-hash.json"),
            &source_hash,
        )
        .map_err(|error| {
            WorkerFailure::failed(JobStage::Preflight, "PREFLIGHT_FAILED", error.to_string())
        })?;
        if !finish_stage(
            &mut engine,
            job_id,
            JobStage::Preflight,
            source.descriptor.size_bytes,
            json!({ "assessment": assessment, "sourceHash": source_hash }),
            control,
        )? {
            return Ok(());
        }
    }

    if !stage_completed(&engine, job_id, JobStage::PartitionScan)? {
        if !begin_stage(&mut engine, job_id, JobStage::PartitionScan, control)? {
            return Ok(());
        }
        let partitions = scan_partitions(source.canonical_path.clone()).map_err(|error| {
            WorkerFailure::failed(JobStage::PartitionScan, "PARTITION_SCAN_FAILED", error)
        })?;
        write_json_atomic(
            &job_directory(root, job_id).join("partitions.json"),
            &partitions,
        )
        .map_err(|error| {
            WorkerFailure::failed(
                JobStage::PartitionScan,
                "PARTITION_SCAN_FAILED",
                error.to_string(),
            )
        })?;
        if !finish_stage(
            &mut engine,
            job_id,
            JobStage::PartitionScan,
            source.descriptor.size_bytes,
            serde_json::to_value(partitions).unwrap_or_default(),
            control,
        )? {
            return Ok(());
        }
    }

    let mut limitations = load_limitations(root, job_id).map_err(|(_, message)| {
        WorkerFailure::failed(JobStage::MetadataScan, "LIMITATION_STORE_FAILED", message)
    })?;
    add_limitation(
        &mut limitations,
        limitation(
            "TSK_METADATA_UNAVAILABLE",
            JobStage::MetadataScan,
            "Sleuth Kit metadata recovery is not available in the current verified tool catalog.",
            "Install and verify Sleuth Kit to recover surviving original names and paths.",
        ),
    );
    if !stage_completed(&engine, job_id, JobStage::MetadataScan)? {
        if !begin_stage(&mut engine, job_id, JobStage::MetadataScan, control)? {
            return Ok(());
        }
        if !finish_stage(
            &mut engine,
            job_id,
            JobStage::MetadataScan,
            0,
            json!({ "limitations": limitations }),
            control,
        )? {
            return Ok(());
        }
    }
    if !permits_raw_carving(job.goal) {
        write_json_atomic(
            &job_directory(root, job_id).join("limitations.json"),
            &limitations,
        )
        .map_err(|error| {
            WorkerFailure::failed(
                JobStage::MetadataScan,
                "LIMITATION_STORE_FAILED",
                error.to_string(),
            )
        })?;
        return Err(WorkerFailure::attention(
            JobStage::MetadataScan,
            "METADATA_ENGINE_UNAVAILABLE",
            "The selected goal requires metadata recovery",
        ));
    }

    add_limitation(
        &mut limitations,
        limitation(
            "PHOTOREC_UNAVAILABLE",
            JobStage::Carving,
            "PhotoRec is unavailable; the built-in bounded JPEG signature engine was used.",
            "Install and verify PhotoRec for broader content-signature coverage.",
        ),
    );
    add_limitation(
        &mut limitations,
        limitation(
            "YARA_X_UNAVAILABLE",
            JobStage::ThreatScan,
            "YARA-X is not available in the current verified tool catalog; recovered content was not threat-scanned.",
            "Install and verify YARA-X before relying on threat classifications.",
        ),
    );
    write_json_atomic(
        &job_directory(root, job_id).join("limitations.json"),
        &limitations,
    )
    .map_err(|error| {
        WorkerFailure::failed(
            JobStage::Carving,
            "LIMITATION_STORE_FAILED",
            error.to_string(),
        )
    })?;

    let artifacts_path = job_directory(root, job_id).join("artifacts.json");
    let mut artifacts =
        if stage_completed(&engine, job_id, JobStage::Carving)? && artifacts_path.exists() {
            load_artifacts(root, job_id).map_err(|(_, message)| {
                WorkerFailure::failed(JobStage::Carving, "ARTIFACT_STORE_FAILED", message)
            })?
        } else {
            if !begin_stage(&mut engine, job_id, JobStage::Carving, control)? {
                return Ok(());
            }
            let artifacts = carve_jpegs(root, job_id, source, control)?;
            write_json_atomic(&artifacts_path, &artifacts).map_err(|error| {
                WorkerFailure::failed(
                    JobStage::Carving,
                    "ARTIFACT_STORE_FAILED",
                    error.to_string(),
                )
            })?;
            if !finish_stage(
                &mut engine,
                job_id,
                JobStage::Carving,
                source.descriptor.size_bytes,
                json!({ "artifactCount": artifacts.len(), "limitations": limitations }),
                control,
            )? {
                return Ok(());
            }
            artifacts
        };

    if !stage_completed(&engine, job_id, JobStage::Validating)? {
        if !begin_stage(&mut engine, job_id, JobStage::Validating, control)? {
            return Ok(());
        }
        validate_artifacts(root, &mut artifacts)?;
        write_json_atomic(&artifacts_path, &artifacts).map_err(|error| {
            WorkerFailure::failed(
                JobStage::Validating,
                "ARTIFACT_STORE_FAILED",
                error.to_string(),
            )
        })?;
        if !finish_stage(
            &mut engine,
            job_id,
            JobStage::Validating,
            artifacts.len() as u64,
            json!({ "artifactCount": artifacts.len() }),
            control,
        )? {
            return Ok(());
        }
    }

    if !stage_completed(&engine, job_id, JobStage::ThreatScan)? {
        if !begin_stage(&mut engine, job_id, JobStage::ThreatScan, control)? {
            return Ok(());
        }
        for artifact in &mut artifacts {
            artifact.threat_status = ThreatStatus::NotScanned;
            artifact.preview_status = PreviewStatus::Unsupported;
        }
        write_json_atomic(&artifacts_path, &artifacts).map_err(|error| {
            WorkerFailure::failed(
                JobStage::ThreatScan,
                "ARTIFACT_STORE_FAILED",
                error.to_string(),
            )
        })?;
        if !finish_stage(
            &mut engine,
            job_id,
            JobStage::ThreatScan,
            artifacts.len() as u64,
            json!({ "artifactCount": artifacts.len(), "limitations": limitations }),
            control,
        )? {
            return Ok(());
        }
    }

    if !stage_completed(&engine, job_id, JobStage::Indexing)? {
        if !begin_stage(&mut engine, job_id, JobStage::Indexing, control)? {
            return Ok(());
        }
        index_artifacts(root, job_id, &artifacts)?;
        if !finish_stage(
            &mut engine,
            job_id,
            JobStage::Indexing,
            artifacts.len() as u64,
            json!({ "artifactCount": artifacts.len() }),
            control,
        )? {
            return Ok(());
        }
    }
    for stage in [JobStage::ReviewReady, JobStage::Completed] {
        if !stage_completed(&engine, job_id, stage)?
            && (!begin_stage(&mut engine, job_id, stage, control)?
                || !finish_stage(
                    &mut engine,
                    job_id,
                    stage,
                    artifacts.len() as u64,
                    json!({ "artifactCount": artifacts.len() }),
                    control,
                )?)
        {
            return Ok(());
        }
    }
    Ok(())
}

fn begin_stage(
    engine: &mut JobEngine,
    job_id: Uuid,
    stage: JobStage,
    control: &JobControl,
) -> Result<bool, WorkerFailure> {
    let _gate = control.checkpoint_gate.lock().expect("checkpoint gate");
    if control.requested() != CONTROL_RUNNING {
        return Ok(false);
    }
    engine
        .checkpoint(
            job_id,
            stage,
            CheckpointStatus::InProgress,
            0,
            json!({ "phase": "running" }),
        )
        .map_err(|error| WorkerFailure::failed(stage, "CHECKPOINT_FAILED", error.to_string()))?;
    Ok(true)
}

fn finish_stage(
    engine: &mut JobEngine,
    job_id: Uuid,
    stage: JobStage,
    progress: u64,
    continuation: Value,
    control: &JobControl,
) -> Result<bool, WorkerFailure> {
    let _gate = control.checkpoint_gate.lock().expect("checkpoint gate");
    if control.requested() != CONTROL_RUNNING {
        return Ok(false);
    }
    engine
        .checkpoint(
            job_id,
            stage,
            CheckpointStatus::Completed,
            progress,
            continuation,
        )
        .map_err(|error| WorkerFailure::failed(stage, "CHECKPOINT_FAILED", error.to_string()))?;
    Ok(true)
}

fn stage_completed(
    engine: &JobEngine,
    job_id: Uuid,
    stage: JobStage,
) -> Result<bool, WorkerFailure> {
    engine
        .checkpoint_for(job_id, stage)
        .map(|checkpoint| {
            checkpoint.is_some_and(|value| value.status == CheckpointStatus::Completed)
        })
        .map_err(|error| WorkerFailure::failed(stage, "CHECKPOINT_FAILED", error.to_string()))
}

fn persist_worker_failure(root: &Path, job_id: Uuid, control: &JobControl, failure: WorkerFailure) {
    let _gate = control.checkpoint_gate.lock().expect("checkpoint gate");
    if control.requested() != CONTROL_RUNNING {
        return;
    }
    let terminal = if failure.needs_attention {
        JobStage::NeedsAttention
    } else {
        JobStage::Failed
    };
    if let Ok(mut engine) = JobEngine::open(root) {
        let _ = engine.checkpoint(
            job_id,
            failure.stage,
            CheckpointStatus::Failed,
            0,
            json!({
                "failedStage": failure.stage,
                "code": failure.code,
                "message": failure.message
            }),
        );
        if failure.needs_attention {
            let _ = engine.needs_attention(job_id, failure.stage, failure.code);
        } else {
            let _ = engine.checkpoint(
                job_id,
                terminal,
                CheckpointStatus::Failed,
                0,
                json!({ "failedStage": failure.stage, "code": failure.code }),
            );
        }
    }
}

fn add_limitation(limitations: &mut Vec<CapabilityLimitation>, value: CapabilityLimitation) {
    if !limitations.iter().any(|item| item.code == value.code) {
        limitations.push(value);
    }
}

fn carve_jpegs(
    root: &Path,
    job_id: Uuid,
    source: &ImageSource,
    control: &JobControl,
) -> Result<Vec<RecoveryArtifact>, WorkerFailure> {
    let bytes = read_source_controlled(&source.canonical_path, control).map_err(|error| {
        WorkerFailure::attention(JobStage::Carving, "SOURCE_READ_FAILED", error.to_string())
    })?;
    let carved = job_directory(root, job_id).join("carved");
    fs::create_dir_all(&carved).map_err(|error| {
        WorkerFailure::failed(JobStage::Carving, "CARVING_FAILED", error.to_string())
    })?;
    let mut artifacts = Vec::new();
    let mut cursor = 0;
    while cursor + 3 <= bytes.len() {
        if control.requested() != CONTROL_RUNNING {
            break;
        }
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
        fs::write(&path, &bytes[start..end]).map_err(|error| {
            WorkerFailure::failed(JobStage::Carving, "CARVING_FAILED", error.to_string())
        })?;
        let mut artifact = normalize_carved_file(&source.descriptor.source_id, &path, "jpeg")
            .map_err(|error| {
                WorkerFailure::failed(JobStage::Carving, "CARVING_FAILED", error.to_string())
            })?;
        artifact.source_ranges = vec![SourceRange {
            offset: start as u64,
            length: (end - start) as u64,
        }];
        fs::copy(&path, artifact_payload_path(root, &artifact)).map_err(|error| {
            WorkerFailure::failed(JobStage::Carving, "CARVING_FAILED", error.to_string())
        })?;
        artifacts.push(artifact);
        cursor = end;
    }
    Ok(artifacts)
}

fn validate_artifacts(
    root: &Path,
    artifacts: &mut [RecoveryArtifact],
) -> Result<(), WorkerFailure> {
    for artifact in artifacts {
        let outcome = ValidatorRegistry::default()
            .validate(&artifact_payload_path(root, artifact), Default::default())
            .map_err(|error| {
                WorkerFailure::failed(JobStage::Validating, "VALIDATION_FAILED", error.to_string())
            })?;
        artifact.recovery_state = outcome.state;
        artifact.mime_type = outcome.detected_type;
        artifact.preview_status = PreviewStatus::Unsupported;
    }
    Ok(())
}

fn index_artifacts(
    root: &Path,
    job_id: Uuid,
    artifacts: &[RecoveryArtifact],
) -> Result<(), WorkerFailure> {
    let mut index = ArtifactIndex::open(&job_directory(root, job_id).join("results.sqlite"))
        .map_err(|error| {
            WorkerFailure::failed(JobStage::Indexing, "INDEXING_FAILED", error.to_string())
        })?;
    let rows = artifacts
        .iter()
        .map(|artifact| ArtifactRow {
            artifact_id: artifact.artifact_id.clone(),
            display_name: artifact.display_name.clone(),
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
    index.insert_batch(&rows).map_err(|error| {
        WorkerFailure::failed(JobStage::Indexing, "INDEXING_FAILED", error.to_string())
    })
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

fn load_sources(root: &Path) -> (HashMap<String, ImageSource>, Option<String>) {
    let mut sources = HashMap::new();
    let mut latest = None;
    if let Ok(entries) = fs::read_dir(root.join("sources")) {
        let mut entries = entries.flatten().collect::<Vec<_>>();
        entries.sort_by_key(|entry| {
            entry
                .metadata()
                .and_then(|metadata| metadata.modified())
                .ok()
        });
        for entry in entries {
            if let Ok(source) = read_json::<ImageSource>(&entry.path()) {
                latest = Some(source.descriptor.source_id.clone());
                sources.insert(source.descriptor.source_id.clone(), source);
            }
        }
    }
    (sources, latest)
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

fn controlled_sha256_file(path: &Path, control: &JobControl) -> std::io::Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        if control.requested() != CONTROL_RUNNING {
            return Ok(String::new());
        }
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

fn read_source_controlled(path: &Path, control: &JobControl) -> std::io::Result<Vec<u8>> {
    let mut file = fs::File::open(path)?;
    let mut bytes = Vec::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        if control.requested() != CONTROL_RUNNING {
            break;
        }
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&buffer[..read]);
    }
    Ok(bytes)
}

fn is_active_or_unsupported(artifact: &RecoveryArtifact) -> bool {
    let active_extension = matches!(
        artifact
            .extension
            .as_deref()
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some(
            "exe"
                | "dll"
                | "com"
                | "bat"
                | "cmd"
                | "ps1"
                | "sh"
                | "js"
                | "html"
                | "htm"
                | "jar"
                | "msi"
        )
    );
    let passive_preview_input = matches!(
        artifact.mime_type.as_deref(),
        Some("image/jpeg" | "image/png" | "application/pdf" | "text/plain")
    );
    active_extension || !passive_preview_input
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PhysicalBacking {
    ProvenPhysical,
    Virtual,
    Composite,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PhysicalDeviceEvidence {
    stable_id: String,
    backing: PhysicalBacking,
}

fn validate_export_destination(
    source: &Path,
    case_root: &Path,
    destination: &Path,
    source_device: &PhysicalDeviceEvidence,
    destination_device: &PhysicalDeviceEvidence,
) -> Result<(String, String), (&'static str, String)> {
    let source = normalized_target(source)
        .map_err(|error| ("EXPORT_DESTINATION_UNVERIFIED", error.to_string()))?;
    let case_root = normalized_target(case_root)
        .map_err(|error| ("EXPORT_DESTINATION_UNVERIFIED", error.to_string()))?;
    let destination = normalized_target(destination)
        .map_err(|error| ("EXPORT_DESTINATION_UNVERIFIED", error.to_string()))?;
    if paths_overlap(&destination, &source) || paths_overlap(&destination, &case_root) {
        return Err((
            "EXPORT_DESTINATION_OVERLAP",
            "The export destination must not contain or overwrite the source image or case workspace"
            .into(),
        ));
    }
    if source_device.backing != PhysicalBacking::ProvenPhysical
        || destination_device.backing != PhysicalBacking::ProvenPhysical
    {
        return Err((
            "EXPORT_DESTINATION_UNVERIFIED",
            "The daemon cannot prove that source and destination have distinct non-virtual physical backing"
                .into(),
        ));
    }
    if source_device.stable_id == destination_device.stable_id {
        return Err((
            "EXPORT_DESTINATION_NOT_SEPARATE",
            "The daemon resolved the source image and destination to the same physical device"
                .into(),
        ));
    }
    Ok((
        source_device.stable_id.clone(),
        destination_device.stable_id.clone(),
    ))
}

fn paths_overlap(left: &Path, right: &Path) -> bool {
    left.starts_with(right) || right.starts_with(left)
}

fn normalized_target(path: &Path) -> std::io::Result<PathBuf> {
    let mut existing = path.to_path_buf();
    let mut missing = Vec::new();
    while !existing.exists() {
        let name = existing.file_name().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("no existing ancestor for {}", path.display()),
            )
        })?;
        missing.push(name.to_os_string());
        if !existing.pop() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("no existing ancestor for {}", path.display()),
            ));
        }
    }
    let mut normalized = fs::canonicalize(existing)?;
    for component in missing.into_iter().rev() {
        normalized.push(component);
    }
    Ok(normalized)
}

fn physical_device_evidence(path: &Path) -> std::io::Result<PhysicalDeviceEvidence> {
    let existing = existing_ancestor(path)?;
    physical_device_evidence_for_existing(&existing)
}

fn existing_ancestor(path: &Path) -> std::io::Result<PathBuf> {
    let mut candidate = path.to_path_buf();
    while !candidate.exists() {
        if !candidate.pop() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "no existing ancestor for destination",
            ));
        }
    }
    fs::canonicalize(candidate)
}

#[cfg(windows)]
fn physical_device_evidence_for_existing(path: &Path) -> std::io::Result<PhysicalDeviceEvidence> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::{Component, Prefix};
    use std::ptr::{null, null_mut};
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows_sys::Win32::System::IO::DeviceIoControl;
    use windows_sys::Win32::System::Ioctl::{
        IOCTL_STORAGE_GET_DEVICE_NUMBER_EX, IOCTL_STORAGE_QUERY_PROPERTY, PropertyStandardQuery,
        STORAGE_DEVICE_DESCRIPTOR, STORAGE_DEVICE_NUMBER_EX, STORAGE_PROPERTY_QUERY,
        StorageDeviceProperty,
    };

    let letter = match path.components().next() {
        Some(Component::Prefix(prefix)) => match prefix.kind() {
            Prefix::Disk(letter) | Prefix::VerbatimDisk(letter) => letter,
            _ => {
                return Err(std::io::Error::other(
                    "physical identity for this Windows path is not provable",
                ));
            }
        },
        _ => {
            return Err(std::io::Error::other(
                "physical identity for this Windows path is not provable",
            ));
        }
    };
    let volume = format!(r"\\.\{}:", (letter as char).to_ascii_uppercase());
    let wide = OsStr::new(&volume)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            0,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            null(),
            OPEN_EXISTING,
            0,
            null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(std::io::Error::last_os_error());
    }
    let result = (|| {
        let mut device = STORAGE_DEVICE_NUMBER_EX::default();
        let mut returned = 0_u32;
        let success = unsafe {
            DeviceIoControl(
                handle,
                IOCTL_STORAGE_GET_DEVICE_NUMBER_EX,
                null(),
                0,
                (&mut device as *mut STORAGE_DEVICE_NUMBER_EX).cast(),
                std::mem::size_of::<STORAGE_DEVICE_NUMBER_EX>() as u32,
                &mut returned,
                null_mut(),
            )
        };
        if success == 0 {
            return Err(std::io::Error::last_os_error());
        }

        let query = STORAGE_PROPERTY_QUERY {
            PropertyId: StorageDeviceProperty,
            QueryType: PropertyStandardQuery,
            AdditionalParameters: [0],
        };
        let mut descriptor_buffer = [0_usize; 128];
        let success = unsafe {
            DeviceIoControl(
                handle,
                IOCTL_STORAGE_QUERY_PROPERTY,
                (&query as *const STORAGE_PROPERTY_QUERY).cast(),
                std::mem::size_of::<STORAGE_PROPERTY_QUERY>() as u32,
                descriptor_buffer.as_mut_ptr().cast(),
                std::mem::size_of_val(&descriptor_buffer) as u32,
                &mut returned,
                null_mut(),
            )
        };
        if success == 0 {
            return Err(std::io::Error::last_os_error());
        }
        if returned < std::mem::size_of::<STORAGE_DEVICE_DESCRIPTOR>() as u32 {
            return Err(std::io::Error::other(
                "Windows storage descriptor was truncated",
            ));
        }
        let descriptor = unsafe {
            &*descriptor_buffer
                .as_ptr()
                .cast::<STORAGE_DEVICE_DESCRIPTOR>()
        };
        let guid = device.DeviceGuid;
        let guid_is_zero = guid.data1 == 0
            && guid.data2 == 0
            && guid.data3 == 0
            && guid.data4.iter().all(|byte| *byte == 0);
        let mut backing = classify_windows_storage_evidence(descriptor.BusType, device.Flags);
        if guid_is_zero {
            backing = PhysicalBacking::Unknown;
        }
        Ok(PhysicalDeviceEvidence {
            stable_id: format!(
                "windows-storage-device:{:08x}{:04x}{:04x}{}",
                guid.data1,
                guid.data2,
                guid.data3,
                guid.data4
                    .iter()
                    .map(|byte| format!("{byte:02x}"))
                    .collect::<String>()
            ),
            backing,
        })
    })();
    unsafe {
        CloseHandle(handle);
    }
    result
}

#[cfg(windows)]
fn classify_windows_storage_evidence(
    bus_type: windows_sys::Win32::Storage::FileSystem::STORAGE_BUS_TYPE,
    device_flags: u32,
) -> PhysicalBacking {
    use windows_sys::Win32::Storage::FileSystem::{
        BusType1394 as BUS_TYPE_1394, BusTypeAta as BUS_TYPE_ATA,
        BusTypeFileBackedVirtual as BUS_TYPE_FILE_BACKED_VIRTUAL, BusTypeMmc as BUS_TYPE_MMC,
        BusTypeNvme as BUS_TYPE_NVME, BusTypeRAID as BUS_TYPE_RAID, BusTypeSCM as BUS_TYPE_SCM,
        BusTypeSata as BUS_TYPE_SATA, BusTypeSd as BUS_TYPE_SD, BusTypeSpaces as BUS_TYPE_SPACES,
        BusTypeUfs as BUS_TYPE_UFS, BusTypeUsb as BUS_TYPE_USB, BusTypeVirtual as BUS_TYPE_VIRTUAL,
    };
    use windows_sys::Win32::System::Ioctl::{
        STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_CONFLICT,
        STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_NOHWID,
    };

    if device_flags
        & (STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_CONFLICT
            | STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_NOHWID)
        != 0
    {
        return PhysicalBacking::Unknown;
    }

    match bus_type {
        BUS_TYPE_ATA | BUS_TYPE_SATA | BUS_TYPE_NVME | BUS_TYPE_USB | BUS_TYPE_SD
        | BUS_TYPE_MMC | BUS_TYPE_1394 | BUS_TYPE_UFS | BUS_TYPE_SCM => {
            PhysicalBacking::ProvenPhysical
        }
        BUS_TYPE_VIRTUAL | BUS_TYPE_FILE_BACKED_VIRTUAL => PhysicalBacking::Virtual,
        BUS_TYPE_SPACES | BUS_TYPE_RAID => PhysicalBacking::Composite,
        _ => PhysicalBacking::Unknown,
    }
}

#[cfg(target_os = "linux")]
fn physical_device_evidence_for_existing(path: &Path) -> std::io::Result<PhysicalDeviceEvidence> {
    use std::os::unix::fs::MetadataExt;

    let device = fs::metadata(path)?.dev();
    let major = ((device >> 8) & 0xfff) | ((device >> 32) & !0xfff);
    let minor = (device & 0xff) | ((device >> 12) & !0xff);
    let sysfs = fs::canonicalize(format!("/sys/dev/block/{major}:{minor}"))?;
    let components = sysfs
        .components()
        .map(|component| component.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    let block = components
        .iter()
        .position(|component| component == "block")
        .and_then(|index| components.get(index + 1))
        .ok_or_else(|| std::io::Error::other("physical block device is not provable"))?;
    if components.iter().any(|component| component == "virtual") {
        return Err(std::io::Error::other(
            "virtual block-device backing is not physically provable",
        ));
    }
    Ok(PhysicalDeviceEvidence {
        stable_id: format!("linux-block-device:{block}"),
        backing: PhysicalBacking::ProvenPhysical,
    })
}

#[cfg(not(any(windows, target_os = "linux")))]
fn physical_device_evidence_for_existing(_path: &Path) -> std::io::Result<PhysicalDeviceEvidence> {
    Err(std::io::Error::other(
        "physical-device identity is not supported on this platform",
    ))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_policy_accepts_separate_daemon_derived_physical_devices() {
        let source_device = PhysicalDeviceEvidence {
            stable_id: "physical-disk:0".into(),
            backing: PhysicalBacking::ProvenPhysical,
        };
        let destination_device = PhysicalDeviceEvidence {
            stable_id: "physical-disk:1".into(),
            backing: PhysicalBacking::ProvenPhysical,
        };
        let result = validate_export_destination(
            Path::new("/evidence/source.raw"),
            Path::new("/case"),
            Path::new("/safe-export"),
            &source_device,
            &destination_device,
        );

        assert_eq!(
            result.unwrap(),
            ("physical-disk:0".into(), "physical-disk:1".into())
        );
    }

    #[test]
    fn export_policy_refuses_same_device_and_case_or_source_overlap() {
        let source_device = PhysicalDeviceEvidence {
            stable_id: "physical-disk:0".into(),
            backing: PhysicalBacking::ProvenPhysical,
        };
        let same_device = PhysicalDeviceEvidence {
            stable_id: "physical-disk:0".into(),
            backing: PhysicalBacking::ProvenPhysical,
        };
        let separate_device = PhysicalDeviceEvidence {
            stable_id: "physical-disk:1".into(),
            backing: PhysicalBacking::ProvenPhysical,
        };
        let same_device = validate_export_destination(
            Path::new("/evidence/source.raw"),
            Path::new("/case"),
            Path::new("/safe-export"),
            &source_device,
            &same_device,
        )
        .unwrap_err();
        assert_eq!(same_device.0, "EXPORT_DESTINATION_NOT_SEPARATE");

        let case_overlap = validate_export_destination(
            Path::new("/evidence/source.raw"),
            Path::new("/case"),
            Path::new("/case/exports"),
            &source_device,
            &separate_device,
        )
        .unwrap_err();
        assert_eq!(case_overlap.0, "EXPORT_DESTINATION_OVERLAP");

        let source_overlap = validate_export_destination(
            Path::new("/evidence/source.raw"),
            Path::new("/case"),
            Path::new("/evidence"),
            &source_device,
            &separate_device,
        )
        .unwrap_err();
        assert_eq!(source_overlap.0, "EXPORT_DESTINATION_OVERLAP");
    }

    #[test]
    fn export_policy_refuses_virtual_composite_and_unknown_backing() {
        let physical = PhysicalDeviceEvidence {
            stable_id: "physical-disk:0".into(),
            backing: PhysicalBacking::ProvenPhysical,
        };
        for backing in [
            PhysicalBacking::Virtual,
            PhysicalBacking::Composite,
            PhysicalBacking::Unknown,
        ] {
            let unproven = PhysicalDeviceEvidence {
                stable_id: format!("unproven-{backing:?}"),
                backing,
            };
            for (source, destination) in [(&physical, &unproven), (&unproven, &physical)] {
                let error = validate_export_destination(
                    Path::new("/evidence/source.raw"),
                    Path::new("/case"),
                    Path::new("/safe-export"),
                    source,
                    destination,
                )
                .unwrap_err();
                assert_eq!(error.0, "EXPORT_DESTINATION_UNVERIFIED");
            }
        }
    }

    #[cfg(windows)]
    #[test]
    fn windows_bus_classifier_denies_virtual_composite_and_unknown_storage() {
        use windows_sys::Win32::Storage::FileSystem::{
            BusTypeFileBackedVirtual, BusTypeNvme, BusTypeRAID, BusTypeSas, BusTypeSpaces,
            BusTypeUnknown, BusTypeVirtual,
        };
        use windows_sys::Win32::System::Ioctl::{
            STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_CONFLICT,
            STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_NOHWID,
        };

        assert_eq!(
            classify_windows_storage_evidence(BusTypeNvme, 0),
            PhysicalBacking::ProvenPhysical
        );
        for bus_type in [BusTypeVirtual, BusTypeFileBackedVirtual] {
            assert_eq!(
                classify_windows_storage_evidence(bus_type, 0),
                PhysicalBacking::Virtual
            );
        }
        for bus_type in [BusTypeSpaces, BusTypeRAID] {
            assert_eq!(
                classify_windows_storage_evidence(bus_type, 0),
                PhysicalBacking::Composite
            );
        }
        assert_eq!(
            classify_windows_storage_evidence(BusTypeUnknown, 0),
            PhysicalBacking::Unknown
        );
        assert_eq!(
            classify_windows_storage_evidence(BusTypeSas, 0),
            PhysicalBacking::Unknown
        );
        for flags in [
            STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_NOHWID,
            STORAGE_DEVICE_FLAGS_RANDOM_DEVICEGUID_REASON_CONFLICT,
        ] {
            assert_eq!(
                classify_windows_storage_evidence(BusTypeNvme, flags),
                PhysicalBacking::Unknown
            );
        }
    }
}
