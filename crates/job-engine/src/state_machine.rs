pub use recovery_domain::{JobStage, can_transition};

pub fn next_stage(stage: JobStage) -> Option<JobStage> {
    use JobStage::*;
    match stage {
        Draft => Some(Preflight),
        Preflight | VerifyingImage => Some(PartitionScan),
        WaitingForDestination => Some(Acquiring),
        Acquiring => Some(VerifyingImage),
        PartitionScan => Some(MetadataScan),
        MetadataScan | Carving => Some(Validating),
        Validating => Some(ThreatScan),
        ThreatScan => Some(Indexing),
        Indexing => Some(ReviewReady),
        ReviewReady | Exporting | Reporting => Some(Completed),
        Completed | Paused | NeedsAttention | Cancelling | Cancelled | Failed => None,
    }
}
