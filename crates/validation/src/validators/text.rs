use recovery_domain::RecoveryState;

pub fn looks_like_text(bytes: &[u8]) -> bool {
    !bytes.is_empty()
        && bytes
            .iter()
            .filter(|byte| byte.is_ascii_graphic() || byte.is_ascii_whitespace())
            .count()
            * 100
            / bytes.len()
            >= 90
}

pub fn validate(_bytes: &[u8]) -> (RecoveryState, Vec<String>) {
    (RecoveryState::CompleteValidated, Vec::new())
}
