use crate::{AssessmentResult, Decision, SourceScenario};
use recovery_domain::{
    CapabilityFinding, CapabilityLevel, EncryptedState, RuntimeMode, ScanPreset, SourceHealth,
};

pub fn assess_source(
    scenario: SourceScenario,
    preset: ScanPreset,
    mode: RuntimeMode,
) -> AssessmentResult {
    let mut findings = Vec::new();
    if scenario.identity_changed {
        findings.push(finding(
            "SOURCE_IDENTITY_CHANGED",
            CapabilityLevel::Unsupported,
            "Source identity changed",
            "The selected source no longer matches the device or image that was assessed.",
            "Reconnect or reselect the original source.",
        ));
    }
    if scenario.requires_write {
        findings.push(finding("SOURCE_WRITE_REQUIRED", CapabilityLevel::Unsupported, "Read-only recovery is not possible", "This request would require writing to the source, which the recovery platform never permits.", "Choose a read-only recovery workflow."));
    }
    if scenario.encrypted_state == EncryptedState::Locked {
        findings.push(finding("SOURCE_LOCKED", CapabilityLevel::RequiresUnlock, "Encrypted and locked", "The source is encrypted. Provide an authorized recovery key or unlock it through the operating system before analysis. The platform does not crack passwords.", "Refresh after the source is unlocked."));
    }
    if scenario.system_disk && mode == RuntimeMode::Installed && preset != ScanPreset::Quick {
        findings.push(finding("ACTIVE_SYSTEM_DISK_REQUIRES_RESCUE", CapabilityLevel::RequiresRescueMode, "Rescue Mode recommended", "This disk contains the running operating system. Normal activity can overwrite deleted data. Restart in Rescue Mode for the best recovery chance.", "Use Rescue Mode."));
    }
    if scenario.health == SourceHealth::Failing {
        findings.push(finding("FAILING_SOURCE", CapabilityLevel::Limited, "Device failing", "Read errors or health warnings were detected. Repeated scanning may worsen the device. Create a resumable image in Rescue Mode before recovery.", "Start the damaged-device workflow."));
    }
    if scenario.experimental_filesystem {
        findings.push(finding(
            "EXPERIMENTAL_FILESYSTEM",
            CapabilityLevel::Limited,
            "Experimental filesystem support",
            "This filesystem has limited recovery support and some metadata may not be available.",
            "Review the known limitations before continuing.",
        ));
    }
    if scenario.unsupported {
        findings.push(finding(
            "UNSUPPORTED_SOURCE",
            CapabilityLevel::Unsupported,
            "Source unsupported",
            "This source cannot be analyzed by the installed recovery engines.",
            "Create a supported RAW image or choose another source.",
        ));
    }
    if findings.is_empty() {
        findings.push(finding(
            "SOURCE_READY",
            CapabilityLevel::Supported,
            "Ready",
            "This source can be analyzed safely in the current mode.",
            "Continue to choose a recovery goal.",
        ));
    }
    let decision = if findings.iter().any(|finding| {
        matches!(
            finding.level,
            CapabilityLevel::Unsupported | CapabilityLevel::RequiresUnlock
        )
    }) {
        Decision::Blocked
    } else if findings
        .iter()
        .any(|finding| finding.level != CapabilityLevel::Supported)
    {
        Decision::Warning
    } else {
        Decision::Ready
    };
    AssessmentResult {
        decision,
        requires_acknowledgement: decision == Decision::Warning,
        findings,
    }
}

pub(crate) fn finding(
    code: &str,
    level: CapabilityLevel,
    title: &str,
    explanation: &str,
    action: &str,
) -> CapabilityFinding {
    CapabilityFinding {
        code: code.into(),
        level,
        title: title.into(),
        explanation: explanation.into(),
        recommended_action: Some(action.into()),
    }
}
