use image_io::{RawImageReader, SourceReader};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::tempdir;

fn validate_virtual_fixture(path: &Path) -> Result<PathBuf, String> {
    let raw = path.to_string_lossy().replace('/', "\\").to_ascii_lowercase();
    if raw.starts_with(r"\\.\physicaldrive")
        || raw.starts_with(r"\\?\physicaldrive")
        || raw.starts_with(r"\dev\sd")
        || raw.starts_with(r"\dev\nvme")
        || raw.starts_with(r"\dev\mmcblk")
        || raw.starts_with(r"\dev\disk")
    {
        return Err(format!("physical device targets are forbidden: {}", path.display()));
    }
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("virtual fixture is unavailable: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err(format!("virtual fixture must be a regular non-symlink file: {}", path.display()));
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "img" | "raw" | "dd" | "vhd" | "vhdx") {
        return Err(format!("unsupported virtual fixture type: {}", path.display()));
    }
    path.canonicalize()
        .map_err(|error| format!("virtual fixture cannot be resolved: {error}"))
}

#[tokio::test]
async fn explicit_image_fixture_is_read_only_and_identity_stable() {
    let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../testdata/generated/raw-pattern.img");
    let fixture = validate_virtual_fixture(&fixture).expect("repository image fixture is safe");
    let before = sha256(&fs::read(&fixture).expect("read fixture before smoke"));
    let reader = RawImageReader::open(&fixture)
        .await
        .expect("open fixture read-only");
    assert!(reader.len() > 0, "fixture must contain data");
    let mut first_sector = [0_u8; 512];
    reader
        .read_exact_at(0, &mut first_sector)
        .await
        .expect("read first sector");
    assert!(first_sector.iter().any(|byte| *byte != 0));
    reader.verify_unchanged().expect("source identity is stable");
    let after = sha256(&fs::read(&fixture).expect("read fixture after smoke"));
    assert_eq!(after, before, "smoke test must not mutate its source fixture");
}

#[test]
fn physical_device_targets_are_refused_before_open() {
    for unsafe_target in [
        r"\\.\PhysicalDrive0",
        "/dev/sda",
        "/dev/nvme0n1",
        "/dev/mmcblk0",
        "/dev/disk0",
    ] {
        assert!(
            validate_virtual_fixture(Path::new(unsafe_target)).is_err(),
            "physical target must fail closed: {unsafe_target}"
        );
    }
}

#[test]
fn ordinary_files_without_a_virtual_image_extension_are_refused() {
    let directory = tempdir().expect("temporary fixture directory");
    let ordinary_file = directory.path().join("not-a-virtual-device.txt");
    fs::write(&ordinary_file, b"fixture").expect("write ordinary file");
    assert!(validate_virtual_fixture(&ordinary_file).is_err());
}

fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
