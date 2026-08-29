fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("crash") => std::process::exit(23),
        Some("malformed") => println!("{{this is not valid json"),
        Some("oversized") => println!("{}", "x".repeat(2 * 1024 * 1024)),
        _ => println!("ok"),
    }
}
