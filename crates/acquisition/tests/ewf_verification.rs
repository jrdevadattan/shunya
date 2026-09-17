use acquisition::EwfAcquisitionAdapter;
use std::path::Path;

#[test]
fn ewf_acquisition_is_explicit_and_uses_verified_tool_id() {
    let invocation = EwfAcquisitionAdapter.acquire_invocation(
        Path::new("/dev/loop7"),
        Path::new("case/source"),
        Path::new("case"),
    );
    assert_eq!(invocation.tool_id, "ewfacquire");
    assert!(invocation.args.contains(&"encase6".into()));
}
