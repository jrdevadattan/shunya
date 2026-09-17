use crate::ToolRunnerError;
use std::path::PathBuf;
use tokio::fs::File;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};

pub async fn capture<R: AsyncRead + Unpin>(
    mut stream: R,
    path: PathBuf,
    limit: usize,
) -> Result<Vec<String>, ToolRunnerError> {
    let mut file = File::create(path).await?;
    let mut captured = Vec::new();
    let mut total = 0_usize;
    let mut chunk = [0_u8; 8192];
    loop {
        let count = stream.read(&mut chunk).await?;
        if count == 0 {
            break;
        }
        let accepted = count.min(limit.saturating_sub(total));
        if accepted > 0 {
            file.write_all(&chunk[..accepted]).await?;
            captured.extend_from_slice(&chunk[..accepted]);
            total += accepted;
        }
    }
    file.flush().await?;
    Ok(String::from_utf8_lossy(&captured)
        .lines()
        .map(|line| line.chars().take(65_536).collect())
        .collect())
}
