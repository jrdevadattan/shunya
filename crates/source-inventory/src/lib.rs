mod image_source;
mod platform;

pub use image_source::{ImageFinding, ImageFindingCode, ImageSource, identify_image};
pub use platform::list_physical_sources;

use recovery_domain::SourceDescriptor;
use std::path::Path;

#[derive(Debug, Default)]
pub struct SourceInventory;

impl SourceInventory {
    pub fn list_physical_sources(&self) -> Result<Vec<SourceDescriptor>, InventoryError> {
        platform::list_physical_sources()
    }

    pub fn add_image(&self, path: &Path) -> Result<ImageSource, InventoryError> {
        identify_image(path)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum InventoryError {
    #[error("source path is not a regular file: {0}")]
    NotAFile(String),
    #[error("unsupported image type: {0}")]
    UnsupportedImage(String),
    #[error("source inventory I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("platform inventory failed: {0}")]
    Platform(String),
}
