use case_store::{AuditEventInput, CaseInput, CaseStore, FailurePoint};
use std::fs;
use std::io::ErrorKind;
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

#[test]
fn initializes_an_existing_empty_destination_selected_by_a_folder_picker() {
    let workspace = tempdir().unwrap();
    let case_root = workspace.path().join("selected-empty-folder");
    fs::create_dir(&case_root).unwrap();

    let store = CaseStore::create(&case_root, input()).unwrap();

    assert_eq!(store.manifest().workspace_path, case_root);
    assert!(case_root.join("case.json").is_file());
    assert!(case_root.join("case.sqlite").is_file());
}

#[test]
fn refuses_a_broken_symlink_destination() {
    let workspace = tempdir().unwrap();
    let missing_target = workspace.path().join("missing-target");
    let case_root = workspace.path().join("broken-link");
    if !create_directory_symlink(&missing_target, &case_root) {
        return;
    }

    let error = match CaseStore::create(&case_root, input()) {
        Ok(_) => panic!("broken symlink destinations must be refused"),
        Err(error) => error,
    };

    assert!(matches!(
        error,
        case_store::CaseStoreError::DestinationExists(path) if path == case_root
    ));
    assert_eq!(fs::read_link(&case_root).unwrap(), missing_target);
}

#[cfg(windows)]
fn create_directory_symlink(target: &std::path::Path, link: &std::path::Path) -> bool {
    match std::os::windows::fs::symlink_dir(target, link) {
        Ok(()) => true,
        Err(error) if error.kind() == ErrorKind::PermissionDenied => {
            eprintln!("skipping broken symlink test because Windows symlink creation is not permitted: {error}");
            false
        }
        Err(error) => panic!("failed to create directory symlink: {error}"),
    }
}

#[cfg(unix)]
fn create_directory_symlink(target: &std::path::Path, link: &std::path::Path) -> bool {
    std::os::unix::fs::symlink(target, link).unwrap();
    true
}
