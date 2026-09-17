use crate::RecoveryReportManifest;

pub fn render(manifest: &RecoveryReportManifest) -> String {
    format!(
        "# Recovery report\n\n## Case {}\n\nSource: `{}`\n\n## Source geometry\n\n{}\n\n## Tools\n\n{}\n\n## Recovery counts\n\nMethods: {:?}\n\nQuality: {:?}\n\n## Warnings\n\n{}\n\n## Unreadable ranges\n\n{}\n\n## Export manifest\n\n{} verified export record(s).\n\n## Limitations\n\n{}\n",
        manifest.case_id,
        manifest.source_id,
        manifest.source_geometry,
        manifest
            .tools
            .iter()
            .map(|tool| format!("- {} {}", tool.id, tool.version))
            .collect::<Vec<_>>()
            .join("\n"),
        manifest.method_counts,
        manifest.quality_counts,
        manifest
            .warnings
            .iter()
            .map(|warning| format!("- {warning}"))
            .collect::<Vec<_>>()
            .join("\n"),
        manifest
            .unreadable_ranges
            .iter()
            .map(|range| format!("- {range}"))
            .collect::<Vec<_>>()
            .join("\n"),
        manifest.export_manifest.len(),
        manifest
            .limitations
            .iter()
            .map(|item| format!("- {item}"))
            .collect::<Vec<_>>()
            .join("\n")
    )
}
