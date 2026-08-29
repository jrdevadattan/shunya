use recovery_ipc::{MAX_FRAME_SIZE, decode_frames};

#[tokio::test]
async fn parses_two_newline_delimited_requests_without_cross_talk() {
    let input = concat!(
        "{\"id\":\"018f0478-5d5e-7000-8000-000000000001\",\"method\":\"runtime.get\",\"params\":{}}\n",
        "{\"id\":\"018f0478-5d5e-7000-8000-000000000002\",\"method\":\"runtime.get\",\"params\":{}}\n"
    );

    let requests = decode_frames(input.as_bytes()).await.unwrap();
    assert_eq!(requests.len(), 2);
    assert_ne!(requests[0].id, requests[1].id);
}

#[tokio::test]
async fn rejects_unknown_methods_malformed_utf8_and_oversized_frames() {
    let unknown = b"{\"id\":\"018f0478-5d5e-7000-8000-000000000001\",\"method\":\"disk.erase\",\"params\":{}}\n";
    assert!(decode_frames(&unknown[..]).await.is_err());

    let malformed = [0xff, b'\n'];
    assert!(decode_frames(&malformed[..]).await.is_err());

    let oversized = vec![b'x'; MAX_FRAME_SIZE + 2];
    assert!(decode_frames(&oversized[..]).await.is_err());
}
