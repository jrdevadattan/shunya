use recovery_ipc::{MAX_FRAME_SIZE, decode_frames};

#[tokio::test]
async fn malformed_oversized_and_duplicate_rpc_inputs_return_errors_without_panicking() {
    let corpus: Vec<Vec<u8>> = vec![
        b"not json\n".to_vec(),
        b"{\"id\":\"duplicate\",\"method\":\"write\",\"params\":{}}\n".to_vec(),
        b"\xff\xfe\n".to_vec(),
        vec![b'x'; MAX_FRAME_SIZE + 1],
    ];
    for input in corpus {
        let result = decode_frames(input.as_slice()).await;
        assert!(result.is_err(), "malformed frame was accepted");
    }
}
