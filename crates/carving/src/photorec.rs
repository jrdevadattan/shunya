use crate::{CarveRequest, CarvingError, PhotoRecInvocation};

pub fn build_invocation(request: &CarveRequest) -> Result<PhotoRecInvocation, CarvingError> {
    if request.families.is_empty() {
        return Err(CarvingError::NoFileFamilies);
    }
    let output_root = request.job_directory.join("photorec-output");
    let mut commands = vec![
        "partition_none".to_owned(),
        "fileopt".to_owned(),
        "everything,disable".to_owned(),
    ];
    commands.extend(
        request
            .families
            .iter()
            .map(|family| format!("{},enable", family.photorec_name())),
    );
    commands.push("search".into());
    Ok(PhotoRecInvocation {
        tool_id: "photorec".into(),
        args: vec![
            "/d".into(),
            output_root.display().to_string(),
            "/cmd".into(),
            request.image_path.display().to_string(),
            commands.join(","),
        ],
        output_root,
    })
}
