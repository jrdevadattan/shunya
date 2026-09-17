#[derive(Debug, Clone)]
pub struct PeerIdentity {
    pub user_id: String,
    pub administrator: bool,
}

pub fn authenticate(
    peer: &PeerIdentity,
    expected_user: &str,
    supplied_token: &str,
    expected_token: &str,
) -> bool {
    !supplied_token.is_empty()
        && constant_time_eq(supplied_token.as_bytes(), expected_token.as_bytes())
        && (peer.user_id == expected_user || peer.administrator)
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0_u8, |difference, (a, b)| difference | (a ^ b))
        == 0
}
