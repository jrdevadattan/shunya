use exporter::CollisionResolver;
use std::path::Path;

#[test]
fn unicode_and_duplicate_paths_keep_both_deterministically() {
    let mut resolver = CollisionResolver::default();
    let first = resolver.resolve(Path::new("Café/report.pdf"));
    let second = resolver.resolve(Path::new("Cafe\u{301}/report.pdf"));
    let third = resolver.resolve(Path::new("Café/report.pdf"));
    assert_eq!(first.to_string_lossy(), "Café/report.pdf");
    assert!(second.to_string_lossy().contains(" (2)"));
    assert!(third.to_string_lossy().contains(" (3)"));
}
