use crate::{RpcFrame, encode_frame};
use serde_json::json;
use uuid::Uuid;

#[test]
fn encoded_frames_end_with_exactly_one_newline() {
    let encoded = encode_frame(&RpcFrame::Response {
        id: Uuid::nil(),
        result: json!({"mode": "installed"}),
    })
    .unwrap();
    assert!(encoded.ends_with(b"\n"));
    assert!(!encoded.ends_with(b"\n\n"));
}
