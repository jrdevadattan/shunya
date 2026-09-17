use recovery_domain::RecoveryState;
use std::fs;
use tempfile::tempdir;
use validation::ValidatorRegistry;

#[test]
fn truncated_png_is_partial_and_header_like_random_is_corrupt() {
    let directory = tempdir().unwrap();
    let truncated = directory.path().join("truncated.png");
    fs::write(
        &truncated,
        [
            b"\x89PNG\r\n\x1a\n".as_slice(),
            &[0, 0, 0, 13],
            b"IHDR",
            &[0; 13],
        ]
        .concat(),
    )
    .unwrap();
    assert_eq!(
        ValidatorRegistry::default()
            .validate(&truncated, Default::default())
            .unwrap()
            .state,
        RecoveryState::PartialValidated
    );
    let false_positive = directory.path().join("header-like-random.bin");
    fs::write(
        &false_positive,
        [b"\x89PNG\r\n\x1a\n".as_slice(), b"random bytes not chunks"].concat(),
    )
    .unwrap();
    assert_eq!(
        ValidatorRegistry::default()
            .validate(&false_positive, Default::default())
            .unwrap()
            .state,
        RecoveryState::Corrupt
    );
}

#[test]
fn extension_does_not_override_detected_bytes() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("not-really.jpg");
    fs::write(&path, b"plain text evidence\n").unwrap();
    assert_eq!(
        ValidatorRegistry::default()
            .validate(&path, Default::default())
            .unwrap()
            .detected_type
            .as_deref(),
        Some("text/plain")
    );
}
