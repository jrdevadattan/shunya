use crate::{SafePreviewKind, ValidationHints, ValidationOutcome, validators};
use recovery_domain::RecoveryState;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

#[derive(Default)]
pub struct ValidatorRegistry {
    _private: (),
}

impl ValidatorRegistry {
    pub fn validate(
        &self,
        path: &Path,
        hints: ValidationHints,
    ) -> std::io::Result<ValidationOutcome> {
        let bytes = fs::read(path)?;
        let (mut state, findings, detected, preview) = if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
            let (state, findings) = validators::jpeg::validate(&bytes);
            (
                state,
                findings,
                Some("image/jpeg"),
                SafePreviewKind::SanitizedImage,
            )
        } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
            let (state, findings) = validators::png::validate(&bytes);
            (
                state,
                findings,
                Some("image/png"),
                SafePreviewKind::SanitizedImage,
            )
        } else if bytes.starts_with(b"%PDF-") {
            let (state, findings) = validators::pdf::validate(&bytes);
            (
                state,
                findings,
                Some("application/pdf"),
                SafePreviewKind::PdfPages,
            )
        } else if bytes.starts_with(b"PK\x03\x04") {
            let (state, findings) = validators::zip_container::validate(&bytes);
            (
                state,
                findings,
                Some("application/zip"),
                SafePreviewKind::MetadataOnly,
            )
        } else if validators::text::looks_like_text(&bytes) {
            let (state, findings) = validators::text::validate(&bytes);
            (
                state,
                findings,
                Some("text/plain"),
                SafePreviewKind::BoundedText,
            )
        } else {
            (
                RecoveryState::Corrupt,
                vec!["unrecognized or structurally invalid content".into()],
                None,
                SafePreviewKind::Blocked,
            )
        };
        if hints.tool_reported_truncation
            || hints.source_extents_readable == Some(false)
            || hints
                .expected_size
                .is_some_and(|expected| bytes.len() as u64 != expected)
        {
            state = match state {
                RecoveryState::CompleteValidated => RecoveryState::PartialValidated,
                RecoveryState::CompleteUnverified => RecoveryState::PartialUnverified,
                other => other,
            };
        }
        let duplicate_group_id = Sha256::digest(&bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        Ok(ValidationOutcome {
            state,
            findings,
            detected_type: detected.map(str::to_owned),
            safe_preview_kind: preview,
            duplicate_group_id,
        })
    }
}
