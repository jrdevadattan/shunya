mod normalize;
mod testdisk;
mod tsk_mmls;

pub use normalize::{PartitionCandidate, PartitionDescriptor, PartitionScanResult};
pub use testdisk::{TestDiskInvocation, build_read_only_invocation};
pub use tsk_mmls::parse_mmls;

use image_io::{ImageIoError, SourceReader};

#[derive(Default)]
pub struct PartitionScanner {
    pub sector_size: u32,
}

impl PartitionScanner {
    pub async fn scan(
        &self,
        reader: &dyn SourceReader,
    ) -> Result<PartitionScanResult, PartitionScanError> {
        let sector_size = if self.sector_size == 0 {
            512
        } else {
            self.sector_size
        };
        let scan_size = reader.len().min(4 * 1024 * 1024) as usize;
        let mut bytes = vec![0; scan_size];
        reader.read_exact_at(0, &mut bytes).await?;
        let mut result = PartitionScanResult {
            sector_size,
            ..Default::default()
        };
        if bytes.get(510..512) == Some(&[0x55, 0xaa]) {
            if bytes.get(sector_size as usize..sector_size as usize + 8) == Some(b"EFI PART") {
                parse_gpt(&bytes, sector_size, &mut result)?;
            } else {
                parse_mbr(&bytes, sector_size, &mut result)?;
            }
        }
        if result.partitions.is_empty() {
            result.candidates = scan_filesystem_candidates(&bytes, sector_size);
        }
        result.gaps = gaps(&result.partitions, reader.len());
        Ok(result)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PartitionScanError {
    #[error(transparent)]
    Io(#[from] ImageIoError),
    #[error("invalid partition geometry")]
    InvalidGeometry,
}

fn parse_gpt(
    bytes: &[u8],
    sector_size: u32,
    result: &mut PartitionScanResult,
) -> Result<(), PartitionScanError> {
    let header = sector_size as usize;
    let entries_lba = le_u64(bytes, header + 72)?;
    let count = le_u32(bytes, header + 80)?.min(4096);
    let entry_size = le_u32(bytes, header + 84)?;
    if !(128..=4096).contains(&entry_size) {
        return Err(PartitionScanError::InvalidGeometry);
    }
    let entries_start = entries_lba
        .checked_mul(u64::from(sector_size))
        .ok_or(PartitionScanError::InvalidGeometry)? as usize;
    for index in 0..count {
        let offset = entries_start
            .checked_add(index as usize * entry_size as usize)
            .ok_or(PartitionScanError::InvalidGeometry)?;
        let Some(entry) = bytes.get(offset..offset + entry_size as usize) else {
            break;
        };
        if entry[..16].iter().all(|byte| *byte == 0) {
            continue;
        }
        let start = u64::from_le_bytes(entry[32..40].try_into().unwrap());
        let last = u64::from_le_bytes(entry[40..48].try_into().unwrap());
        if last < start {
            continue;
        }
        let sectors = last - start + 1;
        let label_bytes = &entry[56..entry.len().min(128)];
        let label_units: Vec<u16> = label_bytes
            .as_chunks::<2>()
            .0
            .iter()
            .map(|chunk| u16::from_le_bytes(*chunk))
            .take_while(|unit| *unit != 0)
            .collect();
        result.partitions.push(descriptor(
            index + 1,
            start,
            sectors,
            sector_size,
            "GPT",
            String::from_utf16(&label_units).ok(),
        ));
    }
    Ok(())
}

fn parse_mbr(
    bytes: &[u8],
    sector_size: u32,
    result: &mut PartitionScanResult,
) -> Result<(), PartitionScanError> {
    for index in 0..4_u32 {
        let offset = 446 + index as usize * 16;
        let entry = &bytes[offset..offset + 16];
        let partition_type = entry[4];
        let start = u32::from_le_bytes(entry[8..12].try_into().unwrap()) as u64;
        let sectors = u32::from_le_bytes(entry[12..16].try_into().unwrap()) as u64;
        if partition_type == 0 || sectors == 0 {
            continue;
        }
        let kind = match partition_type {
            0x0b | 0x0c => "FAT32",
            0x07 => "NTFS/exFAT",
            0x83 => "Linux",
            _ => "MBR",
        };
        result.partitions.push(descriptor(
            index + 1,
            start,
            sectors,
            sector_size,
            kind,
            None,
        ));
    }
    Ok(())
}

fn descriptor(
    index: u32,
    start: u64,
    sectors: u64,
    sector_size: u32,
    kind: &str,
    label: Option<String>,
) -> PartitionDescriptor {
    PartitionDescriptor {
        partition_id: format!("partition-{index}"),
        index,
        start_sector: start,
        sector_count: sectors,
        start_offset_bytes: start * u64::from(sector_size),
        length_bytes: sectors * u64::from(sector_size),
        partition_type: kind.into(),
        filesystem: None,
        label,
    }
}

fn scan_filesystem_candidates(bytes: &[u8], sector_size: u32) -> Vec<PartitionCandidate> {
    bytes
        .chunks(sector_size as usize)
        .enumerate()
        .filter_map(|(sector, chunk)| {
            let filesystem = if chunk.get(3..11) == Some(b"NTFS    ") {
                Some("NTFS")
            } else if chunk.get(82..90) == Some(b"FAT32   ") {
                Some("FAT32")
            } else {
                None
            }?;
            Some(PartitionCandidate {
                start_sector: sector as u64,
                start_offset_bytes: sector as u64 * u64::from(sector_size),
                filesystem: Some(filesystem.into()),
                confidence: "signature_match".into(),
                source: "read_only_fallback".into(),
            })
        })
        .collect()
}

fn gaps(partitions: &[PartitionDescriptor], source_length: u64) -> Vec<(u64, u64)> {
    let mut sorted = partitions.to_vec();
    sorted.sort_by_key(|partition| partition.start_offset_bytes);
    let mut cursor = 0;
    let mut gaps = Vec::new();
    for partition in sorted {
        if partition.start_offset_bytes > cursor {
            gaps.push((cursor, partition.start_offset_bytes - cursor));
        }
        cursor = cursor.max(
            partition
                .start_offset_bytes
                .saturating_add(partition.length_bytes),
        );
    }
    if cursor < source_length {
        gaps.push((cursor, source_length - cursor));
    }
    gaps
}

fn le_u32(bytes: &[u8], offset: usize) -> Result<u32, PartitionScanError> {
    bytes
        .get(offset..offset + 4)
        .and_then(|value| value.try_into().ok())
        .map(u32::from_le_bytes)
        .ok_or(PartitionScanError::InvalidGeometry)
}
fn le_u64(bytes: &[u8], offset: usize) -> Result<u64, PartitionScanError> {
    bytes
        .get(offset..offset + 8)
        .and_then(|value| value.try_into().ok())
        .map(u64::from_le_bytes)
        .ok_or(PartitionScanError::InvalidGeometry)
}
