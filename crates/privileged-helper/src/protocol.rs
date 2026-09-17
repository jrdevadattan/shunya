use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(tag = "method", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    ListDevices {
        session_token: String,
    },
    OpenReadOnly {
        session_token: String,
        stable_id: String,
    },
    ReadAt {
        session_token: String,
        handle: u64,
        offset: u64,
        length: u32,
    },
    CloseHandle {
        session_token: String,
        handle: u64,
    },
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    MethodNotAllowed,
    InvalidRequest,
    AuthenticationFailed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolError {
    pub code: ErrorCode,
    pub detail: String,
}

pub fn parse_request(value: &str) -> Result<Request, ProtocolError> {
    serde_json::from_str(value).map_err(|error| {
        let code = if serde_json::from_str::<serde_json::Value>(value)
            .ok()
            .and_then(|v| v.get("method").cloned())
            .is_some()
        {
            ErrorCode::MethodNotAllowed
        } else {
            ErrorCode::InvalidRequest
        };
        ProtocolError {
            code,
            detail: error.to_string(),
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mutating_generic_and_unknown_methods_are_not_allowed() {
        for method in [
            "write",
            "format",
            "mount_read_write",
            "run_command",
            "anything_else",
        ] {
            let input = format!(r#"{{"method":"{method}","session_token":"test"}}"#);
            let error = parse_request(&input).unwrap_err();
            assert_eq!(error.code, ErrorCode::MethodNotAllowed);
        }
    }
}
