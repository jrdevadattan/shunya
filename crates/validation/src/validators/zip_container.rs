use recovery_domain::RecoveryState;

pub fn validate(bytes: &[u8]) -> (RecoveryState, Vec<String>) {
    if !bytes.starts_with(b"PK\x03\x04") {
        return (RecoveryState::Corrupt, vec!["invalid ZIP header".into()]);
    }
    if bytes
        .windows(4)
        .rev()
        .take(65_557)
        .any(|window| window == b"PK\x05\x06")
    {
        (RecoveryState::CompleteValidated, Vec::new())
    } else {
        (
            RecoveryState::PartialValidated,
            vec!["missing ZIP central directory".into()],
        )
    }
}
