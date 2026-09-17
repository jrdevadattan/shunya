use std::fs;
use std::path::PathBuf;

fn main() -> std::io::Result<()> {
    let output = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("testdata/generated"));
    fs::create_dir_all(&output)?;
    let total = 1_100_000;
    let boundary = 1_050_123;
    let pattern: Vec<u8> = (0..total).map(|index| (index % 251) as u8).collect();
    fs::write(output.join("raw-pattern.img"), &pattern)?;
    fs::write(output.join("split-pattern.001"), &pattern[..boundary])?;
    fs::write(output.join("split-pattern.002"), &pattern[boundary..])?;
    Ok(())
}
