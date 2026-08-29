mod router;

#[tokio::main]
async fn main() {
    if let Err(error) =
        recovery_ipc::serve(tokio::io::stdin(), tokio::io::stdout(), router::route).await
    {
        eprintln!("recoveryd transport error: {error}");
        std::process::exit(1);
    }
}
