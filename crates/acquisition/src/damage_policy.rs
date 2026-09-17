#[derive(Debug, Clone, Copy)]
pub struct DamageAssessment {
    pub health_warning: bool,
    pub read_errors: u64,
    pub unstable_identity: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DamageRecommendation {
    StandardImage,
    RescueFirstPass,
    StopAndReconnect,
}

pub fn assess_damage(assessment: DamageAssessment) -> DamageRecommendation {
    if assessment.unstable_identity {
        DamageRecommendation::StopAndReconnect
    } else if assessment.health_warning || assessment.read_errors > 0 {
        DamageRecommendation::RescueFirstPass
    } else {
        DamageRecommendation::StandardImage
    }
}
