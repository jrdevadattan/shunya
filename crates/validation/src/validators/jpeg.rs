use recovery_domain::RecoveryState;

pub fn validate(bytes: &[u8]) -> (RecoveryState, Vec<String>) {
    if !bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return (RecoveryState::Corrupt, vec!["invalid JPEG header".into()]);
    }
    if bytes.ends_with(&[0xff, 0xd9]) {
        (RecoveryState::CompleteValidated, Vec::new())
    } else {
        (
            RecoveryState::PartialValidated,
            vec!["missing JPEG end marker".into()],
        )
    }
}
