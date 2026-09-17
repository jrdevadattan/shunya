#[allow(clippy::zombie_processes)] // The inherited-pipe regression requires the parent to exit first.
fn main() {
    let mut arguments = std::env::args().skip(1);
    match arguments.next().as_deref() {
        Some("echo") => println!("{}", arguments.next().unwrap_or_default()),
        Some("version") => println!("fixture-tool 1.2.3"),
        Some("near-version") => println!("fixture-tool 11.2.30"),
        Some("version-with-descendant") => {
            std::process::Command::new(std::env::current_exe().unwrap())
                .arg("sleep-short")
                .spawn()
                .unwrap();
            println!("fixture-tool 1.2.3");
        }
        Some("sleep-short") => std::thread::sleep(std::time::Duration::from_secs(5)),
        Some("sleep") => std::thread::sleep(std::time::Duration::from_secs(60)),
        _ => std::process::exit(2),
    }
}
