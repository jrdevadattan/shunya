use recovery_domain::{JobStage, SourceDescriptor, can_transition};

#[test]
fn source_descriptor_matches_canonical_fixture() {
    let raw = include_str!("../../../packages/contracts/tests/fixtures/source-descriptor.json");
    let source: SourceDescriptor = serde_json::from_str(raw).unwrap();

    assert_eq!(source.size_bytes, 4_000_787_030_016);
    assert_eq!(
        serde_json::to_value(source).unwrap()["sizeBytes"],
        "4000787030016"
    );
}

#[test]
fn completed_job_cannot_return_to_carving() {
    assert!(!can_transition(JobStage::Completed, JobStage::Carving));
}
