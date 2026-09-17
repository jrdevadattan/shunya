use recovery_domain::RecoveryState;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SafePreviewKind {
    SanitizedImage,
    BoundedText,
    PdfPages,
    MetadataOnly,
    Blocked,
}

#[derive(Debug, Clone)]
pub struct ValidationOutcome {
    pub state: RecoveryState,
    pub findings: Vec<String>,
    pub detected_type: Option<String>,
    pub safe_preview_kind: SafePreviewKind,
    pub duplicate_group_id: String,
}

#[derive(Debug, Clone, Default)]
pub struct ValidationHints {
    pub expected_size: Option<u64>,
    pub source_extents_readable: Option<bool>,
    pub tool_reported_truncation: bool,
}
