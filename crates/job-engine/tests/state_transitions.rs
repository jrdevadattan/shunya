use job_engine::{JobStage, can_transition};

#[test]
fn only_declared_transitions_are_allowed() {
    assert!(can_transition(JobStage::Preflight, JobStage::PartitionScan));
    assert!(can_transition(JobStage::Carving, JobStage::Validating));
    assert!(!can_transition(JobStage::Completed, JobStage::MetadataScan));
    assert!(!can_transition(JobStage::Cancelled, JobStage::Exporting));
}
