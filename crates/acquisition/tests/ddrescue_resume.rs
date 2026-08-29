use acquisition::{DdrescueAdapter, DdrescueRun};
use std::path::{Path, PathBuf};

#[test]
fn ddrescue_resume_reuses_exact_destination_and_mapfile() {
    let run = DdrescueRun {
        source: PathBuf::from("/dev/loop7"),
        destination: PathBuf::from("case/damaged.raw"),
        mapfile: PathBuf::from("case/damaged.map"),
    };
    let first = DdrescueAdapter.first_pass(&run, Path::new("case"));
    let resumed = DdrescueAdapter.resume(&run, Path::new("case"));
    assert_eq!(first.args, resumed.args);
    assert!(resumed.args.ends_with(&[
        "/dev/loop7".into(),
        "case/damaged.raw".into(),
        "case/damaged.map".into()
    ]));
}
