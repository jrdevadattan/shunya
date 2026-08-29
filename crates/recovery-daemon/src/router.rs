use recovery_ipc::{RpcErrorBody, RpcFrame, RpcRequest};
use serde_json::json;

pub fn route(request: &RpcRequest) -> RpcFrame {
    if request.method == "runtime.get" {
        let mode = if std::env::var("RECOVERY_RUNTIME_MODE").as_deref() == Ok("rescue") {
            "rescue"
        } else {
            "installed"
        };
        return RpcFrame::Response {
            id: request.id,
            result: json!({ "mode": mode }),
        };
    }

    RpcFrame::Error {
        id: request.id,
        error: RpcErrorBody {
            code: "NOT_IMPLEMENTED".into(),
            message: format!("{} is not implemented yet", request.method),
        },
    }
}
