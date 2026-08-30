use crate::{RpcFrame, RpcRequest};
use std::str;
use thiserror::Error;
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncRead, AsyncWrite, AsyncWriteExt, BufReader};

pub const MAX_FRAME_SIZE: usize = 8 * 1024 * 1024;

const METHODS: &[&str] = &[
    "runtime.get",
    "case.create",
    "case.open",
    "case.state",
    "source.list",
    "source.add_image",
    "source.assess",
    "job.create",
    "job.start",
    "job.pause",
    "job.resume",
    "job.cancel",
    "job.status",
    "job.events",
    "artifact.query",
    "artifact.get",
    "artifact.preview",
    "export.start",
    "report.generate",
];

#[derive(Debug, Error)]
pub enum IpcError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("RPC frame exceeds the 8 MiB limit")]
    FrameTooLarge,
    #[error("RPC frame is not valid UTF-8")]
    InvalidUtf8,
    #[error("invalid RPC JSON: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("unknown RPC method: {0}")]
    UnknownMethod(String),
}

pub async fn read_request<R: AsyncBufRead + Unpin>(
    reader: &mut R,
    pending: &mut Vec<u8>,
) -> Result<Option<RpcRequest>, IpcError> {
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            return if pending.is_empty() {
                Ok(None)
            } else {
                parse_request(std::mem::take(pending)).map(Some)
            };
        }

        if let Some(newline) = available.iter().position(|byte| *byte == b'\n') {
            if pending.len() + newline > MAX_FRAME_SIZE {
                return Err(IpcError::FrameTooLarge);
            }
            pending.extend_from_slice(&available[..newline]);
            reader.consume(newline + 1);
            if pending.last() == Some(&b'\r') {
                pending.pop();
            }
            if pending.is_empty() {
                continue;
            }
            return parse_request(std::mem::take(pending)).map(Some);
        }

        if pending.len() + available.len() > MAX_FRAME_SIZE {
            return Err(IpcError::FrameTooLarge);
        }
        let consumed = available.len();
        pending.extend_from_slice(available);
        reader.consume(consumed);
    }
}

pub async fn decode_frames<R: AsyncRead + Unpin>(reader: R) -> Result<Vec<RpcRequest>, IpcError> {
    let mut reader = BufReader::new(reader);
    let mut pending = Vec::new();
    let mut requests = Vec::new();
    while let Some(request) = read_request(&mut reader, &mut pending).await? {
        requests.push(request);
    }
    Ok(requests)
}

pub fn encode_frame(frame: &RpcFrame) -> Result<Vec<u8>, IpcError> {
    let mut encoded = serde_json::to_vec(frame)?;
    if encoded.len() > MAX_FRAME_SIZE {
        return Err(IpcError::FrameTooLarge);
    }
    encoded.push(b'\n');
    Ok(encoded)
}

pub async fn serve<R, W, F>(reader: R, mut writer: W, route: F) -> Result<(), IpcError>
where
    R: AsyncRead + Unpin,
    W: AsyncWrite + Unpin,
    F: Fn(&RpcRequest) -> RpcFrame,
{
    let mut reader = BufReader::new(reader);
    let mut pending = Vec::new();
    while let Some(request) = read_request(&mut reader, &mut pending).await? {
        writer.write_all(&encode_frame(&route(&request))?).await?;
        writer.flush().await?;
    }
    Ok(())
}

fn parse_request(bytes: Vec<u8>) -> Result<RpcRequest, IpcError> {
    let text = str::from_utf8(&bytes).map_err(|_| IpcError::InvalidUtf8)?;
    let request: RpcRequest = serde_json::from_str(text)?;
    if !METHODS.contains(&request.method.as_str()) {
        return Err(IpcError::UnknownMethod(request.method));
    }
    Ok(request)
}
