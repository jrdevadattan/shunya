use crate::rules::finding;
use crate::{AssessmentResult, Decision, DestinationScenario};
use recovery_domain::CapabilityLevel;

pub fn validate_destination(scenario: DestinationScenario) -> AssessmentResult {
    let mut findings = Vec::new();
    if scenario.same_physical_device {
        findings.push(finding(
            "SAME_PHYSICAL_DEVICE",
            CapabilityLevel::Unsupported,
            "Destination is on the source device",
            "Recovery output cannot be written to the same physical device being recovered.",
            "Choose a destination on a different physical device.",
        ));
    }
    if !scenario.writable {
        findings.push(finding(
            "DESTINATION_READ_ONLY",
            CapabilityLevel::Unsupported,
            "Destination is read-only",
            "The selected destination cannot accept recovery output.",
            "Choose a writable destination.",
        ));
    }
    if scenario.free_bytes < scenario.required_bytes {
        findings.push(finding("INSUFFICIENT_SPACE", CapabilityLevel::Unsupported, "Not enough free space", "The destination does not have the estimated requirement plus the recovery safety reserve.", "Choose a destination with more free space."));
    }
    if scenario.network {
        findings.push(finding(
            "NETWORK_DESTINATION",
            CapabilityLevel::Limited,
            "Network destination",
            "A network interruption can pause or fail recovery output.",
            "Acknowledge the risk or choose a local destination.",
        ));
    }
    if scenario.removable {
        findings.push(finding(
            "REMOVABLE_DESTINATION",
            CapabilityLevel::Limited,
            "Removable destination",
            "Keep this destination connected until the operation completes.",
            "Confirm the device is stable and has reliable power.",
        ));
    }
    if findings.is_empty() {
        findings.push(finding(
            "DESTINATION_READY",
            CapabilityLevel::Supported,
            "Destination ready",
            "The destination is writable, separate from the source, and has enough free space.",
            "Continue to recovery options.",
        ));
    }
    let blocked = findings
        .iter()
        .any(|finding| finding.level == CapabilityLevel::Unsupported);
    let warning = findings
        .iter()
        .any(|finding| finding.level == CapabilityLevel::Limited);
    let decision = if blocked {
        Decision::Blocked
    } else if warning {
        Decision::Warning
    } else {
        Decision::Ready
    };
    AssessmentResult {
        decision,
        requires_acknowledgement: warning && !blocked,
        findings,
    }
}
