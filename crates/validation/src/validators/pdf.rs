use recovery_domain::RecoveryState;

pub fn validate(bytes: &[u8]) -> (RecoveryState, Vec<String>) {
    if !bytes.starts_with(b"%PDF-") {
        return (RecoveryState::Corrupt, vec!["invalid PDF header".into()]);
    }
    if bytes
        .windows(5)
        .rev()
        .take(4096)
        .any(|window| window == b"%%EOF")
    {
        (RecoveryState::CompleteValidated, Vec::new())
    } else {
        (
            RecoveryState::PartialValidated,
            vec!["missing PDF end marker".into()],
        )
    }
}
