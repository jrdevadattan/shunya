use crate::PartitionDescriptor;

pub fn parse_mmls(output: &str, sector_size: u32) -> Vec<PartitionDescriptor> {
    output
        .lines()
        .filter_map(|line| {
            let fields: Vec<_> = line.split_whitespace().collect();
            if fields.len() < 6
                || !fields[0]
                    .trim_end_matches(':')
                    .bytes()
                    .all(|byte| byte.is_ascii_digit())
            {
                return None;
            }
            let index = fields[0].trim_end_matches(':').parse().ok()?;
            let start_sector: u64 = fields[2].parse().ok()?;
            let sector_count: u64 = fields[4].parse().ok()?;
            Some(PartitionDescriptor {
                partition_id: format!("partition-{index}"),
                index,
                start_sector,
                sector_count,
                start_offset_bytes: start_sector.checked_mul(u64::from(sector_size))?,
                length_bytes: sector_count.checked_mul(u64::from(sector_size))?,
                partition_type: fields[5..].join(" "),
                filesystem: None,
                label: None,
            })
        })
        .collect()
}
