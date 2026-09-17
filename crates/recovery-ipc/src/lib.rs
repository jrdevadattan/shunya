mod envelope;
mod server;

pub use envelope::{RpcErrorBody, RpcFrame, RpcRequest};
pub use server::{IpcError, MAX_FRAME_SIZE, decode_frames, encode_frame, read_request, serve};

#[cfg(test)]
mod client_test;
