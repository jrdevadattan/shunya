mod support;

use support::fixture_registry;

#[test]
fn verifies_fixture_hash_and_rejects_tampering() {
    let fixture = fixture_registry();
    assert!(fixture.registry.load_and_verify("fixture").is_ok());
    std::fs::write(&fixture.executable, b"tampered").unwrap();
    assert!(fixture.registry.load_and_verify("fixture").is_err());
}
