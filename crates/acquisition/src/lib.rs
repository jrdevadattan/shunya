mod checkpoint;
mod damage_policy;
mod ddrescue;
mod ewf_acquire;
mod hash;
mod raw_copy;

pub use checkpoint::UnreadableRange;
pub use damage_policy::{DamageAssessment, DamageRecommendation, assess_damage};
pub use ddrescue::{DdrescueAdapter, DdrescueProgress, DdrescueRun};
pub use ewf_acquire::EwfAcquisitionAdapter;
pub use raw_copy::{
    AcquisitionEngine, AcquisitionError, AcquisitionRequest, AcquisitionResult, AcquisitionSource,
    AcquisitionStatus, DEFAULT_BLOCK_SIZE, SourceReadError,
};
