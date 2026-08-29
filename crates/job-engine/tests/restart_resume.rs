use case_store::{CaseInput, CaseStore};
use job_engine::{CheckpointStatus, JobEngine, JobStage, RecoverableState};
use recovery_domain::{RecoveryGoal, ScanPreset};
use serde_json::json;
use tempfile::tempdir;

#[test]
fn restart_does_not_rerun_completed_stages_and_waits_for_user_resume() {
    let temporary = tempdir().unwrap();
    let root = temporary.path().join("case");
    let case_store = CaseStore::create(
        &root,
        CaseInput {
            title: "Restart test".into(),
            operator: "test".into(),
            reference_number: None,
            organization: None,
            notes: None,
        },
    )
    .unwrap();
    let case_id = case_store.manifest().case_id;
    drop(case_store);

    let mut engine = JobEngine::open(&root).unwrap();
    let job = engine
        .create_job(
            case_id,
            "source-1",
            RecoveryGoal::RecoverEverything,
            ScanPreset::Full,
        )
        .unwrap();
    engine
        .checkpoint(
            job.job_id,
            JobStage::PartitionScan,
            CheckpointStatus::Completed,
            100,
            json!({"partitions": 2}),
        )
        .unwrap();
    engine
        .checkpoint(
            job.job_id,
            JobStage::MetadataScan,
            CheckpointStatus::Started,
            41,
            json!({"inode": 842}),
        )
        .unwrap();
    drop(engine);

    let mut reopened = JobEngine::open(&root).unwrap();
    let recovered = reopened.recover_incomplete_jobs().unwrap();
    assert_eq!(recovered[0].state, RecoverableState::PausedRecoverable);
    assert_eq!(recovered[0].resume_stage, JobStage::MetadataScan);
    assert!(
        reopened
            .checkpoint_for(job.job_id, JobStage::PartitionScan)
            .unwrap()
            .unwrap()
            .status
            == CheckpointStatus::Completed
    );
    assert_eq!(
        reopened.resume(job.job_id).unwrap().stage,
        JobStage::MetadataScan
    );
}
