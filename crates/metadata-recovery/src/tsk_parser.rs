use crate::{FlsRecord, MetadataRecoveryError, RecoveryFilters};

pub fn parse_fls(
    output: &str,
    filters: &RecoveryFilters,
) -> Result<Vec<FlsRecord>, MetadataRecoveryError> {
    let mut records = Vec::new();
    for line in output.lines() {
        let Some((metadata, path)) = line.split_once(": ") else {
            continue;
        };
        if !metadata.contains('*') {
            continue;
        }
        let address = metadata
            .split_whitespace()
            .find(|field| {
                field
                    .chars()
                    .next()
                    .is_some_and(|value| value.is_ascii_digit())
            })
            .unwrap_or_default()
            .trim_end_matches(':')
            .to_owned();
        let original_path = crate::path_reconstruction::normalize_path(path);
        let file_name = original_path.rsplit('/').next().unwrap_or_default();
        let (base_name, alternate_stream) = file_name
            .split_once(':')
            .map_or((file_name, None), |(base, stream)| {
                (base, Some(stream.to_owned()))
            });
        let original_name = base_name.to_owned();
        let extension = base_name
            .rsplit_once('.')
            .map(|(_, extension)| extension.to_ascii_lowercase());
        let record = FlsRecord {
            metadata_address: address,
            original_path,
            original_name,
            extension,
            alternate_stream,
            raw_record: line.to_owned(),
        };
        if filters.matches(&record) {
            records.push(record);
        }
    }
    Ok(records)
}
