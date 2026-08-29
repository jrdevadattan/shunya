fn main() {
    let mut arguments = std::env::args().skip(1);
    match arguments.next().as_deref() {
        Some("echo") => println!("{}", arguments.next().unwrap_or_default()),
        Some("version") => println!("fixture-tool 1.2.3"),
        Some("sleep") => std::thread::sleep(std::time::Duration::from_secs(60)),
        _ => std::process::exit(2),
    }
}
