use case_store::{CaseInput, CaseStore};
use tempfile::tempdir;

#[test]
fn corrupt_manifest_is_refused_without_replacing_case_data() {
    let parent = tempdir().unwrap();
    let root = parent.path().join("case");
    drop(
        CaseStore::create(
            &root,
            CaseInput {
                title: "Corruption fixture".into(),
                operator: "Test".into(),
                reference_number: None,
                organization: None,
                notes: None,
            },
        )
        .unwrap(),
    );
    std::fs::write(root.join("case.json"), b"{truncated").unwrap();
    assert!(CaseStore::open(&root).is_err());
    assert!(root.join("case.sqlite").exists());
}
