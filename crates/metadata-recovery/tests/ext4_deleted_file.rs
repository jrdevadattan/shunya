use metadata_recovery::{ExtentState, classify_completeness};
use recovery_domain::RecoveryState;

#[test]
fn overwritten_extent_is_partial_not_complete() {
    assert_eq!(
        classify_completeness(&[ExtentState::Readable, ExtentState::Overwritten]),
        RecoveryState::PartialUnverified
    );
}
