mod peer_auth;
mod protocol;
mod platform {
    pub mod linux;
    pub mod macos;
    pub mod windows;
}

use protocol::{ErrorCode, ProtocolError, parse_request};
use std::io::{self, BufRead};

fn main() {
    let expected_token = std::env::var("RECOVERY_HELPER_SESSION_TOKEN").unwrap_or_default();
    let expected_user = std::env::var("RECOVERY_HELPER_USER").unwrap_or_default();
    let peer = peer_auth::PeerIdentity {
        user_id: expected_user.clone(),
        administrator: false,
    };
    if expected_token.len() < 32 {
        return;
    }
    for line in io::stdin().lock().lines().map_while(Result::ok) {
        let response = match parse_request(&line) {
            Ok(request) => {
                let supplied = match &request {
                    protocol::Request::ListDevices { session_token }
                    | protocol::Request::OpenReadOnly { session_token, .. }
                    | protocol::Request::ReadAt { session_token, .. }
                    | protocol::Request::CloseHandle { session_token, .. } => session_token,
                };
                if !peer_auth::authenticate(&peer, &expected_user, supplied, &expected_token) {
                    serde_json::to_string(&ProtocolError {
                        code: ErrorCode::AuthenticationFailed,
                        detail: "invalid peer identity or session token".into(),
                    })
                    .unwrap()
                } else if let protocol::Request::OpenReadOnly { stable_id, .. } = &request {
                    #[cfg(windows)]
                    let allowed = platform::windows::is_allowed_device_path(stable_id);
                    #[cfg(target_os = "linux")]
                    let allowed = platform::linux::is_allowed_device_path(stable_id);
                    #[cfg(target_os = "macos")]
                    let allowed = platform::macos::is_allowed_device_path(stable_id);
                    if allowed {
                        serde_json::json!({"ok": true, "requestAccepted": true}).to_string()
                    } else {
                        serde_json::to_string(&ProtocolError {
                            code: ErrorCode::InvalidRequest,
                            detail: "device is outside the platform raw-device allowlist".into(),
                        })
                        .unwrap()
                    }
                } else {
                    serde_json::json!({"ok": true, "requestAccepted": true}).to_string()
                }
            }
            Err(error) => serde_json::to_string(&error).unwrap(),
        };
        println!("{response}");
    }
}
