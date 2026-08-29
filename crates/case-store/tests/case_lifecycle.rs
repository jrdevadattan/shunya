use case_store::{AuditEventInput, CaseInput, CaseStore, FailurePoint};
use std::fs;
use tempfile::tempdir;

fn input() -> CaseInput {
    CaseInput {
        title: "Laptop recovery".into(),
        operator: "analyst-7".into(),
        reference_number: Some("INC-26149".into()),
        organization: Some("Recovery Lab".into()),
        notes: None,
    }
}

#[test]
fn failed_creation_does_not_leave_a_half_case() {
    let workspace = tempdir().unwrap();
    let case_root = workspace.path().join("case-a");
    let result =
        CaseStore::create_with_injected_failure(&case_root, input(), FailurePoint::AfterDatabase);
    assert!(result.is_err());
    assert!(!case_root.join("case.json").exists());
    assert!(!case_root.join("case.sqlite").exists());
}

#[test]
fn reopens_case_and_mirrors_append_only_audit_event() {
    let workspace = tempdir().unwrap();
    let case_root = workspace.path().join("case-b");
    let mut store = CaseStore::create(&case_root, input()).unwrap();
    let event = store
        .append_event(AuditEventInput {
            event_type: "case.created".into(),
            actor: "analyst-7".into(),
            payload: serde_json::json!({"source": "ui"}),
        })
        .unwrap();
    store.checkpoint().unwrap();
    drop(store);

    let reopened = CaseStore::open(&case_root).unwrap();
    assert!(reopened.has_audit_event(event.event_id).unwrap());
    let audit = fs::read_to_string(case_root.join("audit/events.ndjson")).unwrap();
    assert!(
        audit
            .lines()
            .any(|line| line.contains(&event.event_id.to_string()))
    );
}

#[test]
fn refuses_to_overwrite_non_empty_destination() {
    let workspace = tempdir().unwrap();
    let case_root = workspace.path().join("existing");
    fs::create_dir(&case_root).unwrap();
    fs::write(case_root.join("do-not-delete.txt"), "user data").unwrap();
    assert!(CaseStore::create(&case_root, input()).is_err());
    assert_eq!(
        fs::read_to_string(case_root.join("do-not-delete.txt")).unwrap(),
        "user data"
    );
}
