use recovery_domain::RecoveryState;

const SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

pub fn validate(bytes: &[u8]) -> (RecoveryState, Vec<String>) {
    if !bytes.starts_with(SIGNATURE) || bytes.len() < 20 {
        return (RecoveryState::Corrupt, vec!["invalid PNG structure".into()]);
    }
    let first_length = u32::from_be_bytes(bytes[8..12].try_into().unwrap()) as usize;
    if &bytes[12..16] != b"IHDR" || first_length != 13 {
        return (RecoveryState::Corrupt, vec!["invalid PNG IHDR".into()]);
    }
    if bytes.windows(12).any(|window| window[4..8] == *b"IEND") {
        (RecoveryState::CompleteValidated, Vec::new())
    } else {
        (
            RecoveryState::PartialValidated,
            vec!["missing PNG IEND chunk".into()],
        )
    }
}
