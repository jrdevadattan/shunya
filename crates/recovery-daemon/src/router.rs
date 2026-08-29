use case_store::{AuditEventInput, CaseInput, CaseStore};
use recovery_ipc::{RpcErrorBody, RpcFrame, RpcRequest};
use serde::Deserialize;
use serde_json::json;
use std::path::PathBuf;

const DESTINATION_RESERVE_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCaseParams {
    title: String,
    operator: String,
    reference_number: Option<String>,
    organization: Option<String>,
    workspace_path: PathBuf,
    notes: Option<String>,
    estimated_required_bytes: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OpenCaseParams {
    case_path: PathBuf,
}

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

    if request.method == "case.create" {
        return create_case(request);
    }

    if request.method == "case.open" {
        let params = match serde_json::from_value::<OpenCaseParams>(request.params.clone()) {
            Ok(params) => params,
            Err(error) => return error_frame(request, "INVALID_CASE_INPUT", error.to_string()),
        };
        return match CaseStore::open(&params.case_path) {
            Ok(store) => RpcFrame::Response {
                id: request.id,
                result: serde_json::to_value(store.manifest()).expect("manifest serializes"),
            },
            Err(error) => error_frame(request, "CASE_OPEN_FAILED", error.to_string()),
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

fn create_case(request: &RpcRequest) -> RpcFrame {
    let params = match serde_json::from_value::<CreateCaseParams>(request.params.clone()) {
        Ok(params) => params,
        Err(error) => return error_frame(request, "INVALID_CASE_INPUT", error.to_string()),
    };
    let destination_parent = params
        .workspace_path
        .parent()
        .unwrap_or(params.workspace_path.as_path());
    if let Ok(free) = fs2::available_space(destination_parent) {
        let required = params
            .estimated_required_bytes
            .unwrap_or(0)
            .saturating_add(DESTINATION_RESERVE_BYTES);
        if free < required {
            return error_frame(
                request,
                "INSUFFICIENT_DESTINATION_SPACE",
                format!("destination has {free} bytes available but {required} bytes are required"),
            );
        }
    }
    let input = CaseInput {
        title: params.title,
        operator: params.operator.clone(),
        reference_number: params.reference_number,
        organization: params.organization,
        notes: params.notes,
    };
    match CaseStore::create(&params.workspace_path, input).and_then(|mut store| {
        store.append_event(AuditEventInput {
            event_type: "case.created".into(),
            actor: params.operator,
            payload: json!({ "source": "desktop" }),
        })?;
        serde_json::to_value(store.manifest()).map_err(case_store::CaseStoreError::from)
    }) {
        Ok(result) => RpcFrame::Response {
            id: request.id,
            result,
        },
        Err(error) => error_frame(request, "CASE_CREATE_FAILED", error.to_string()),
    }
}

fn error_frame(request: &RpcRequest, code: &str, message: String) -> RpcFrame {
    RpcFrame::Error {
        id: request.id,
        error: RpcErrorBody {
            code: code.into(),
            message,
        },
    }
}
