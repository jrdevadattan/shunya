# EWF segment-discovery fixture

`ewf-small.E01` and `ewf-small.E02` are deterministic synthetic files used only to test segment ordering and missing-segment handling. They are deliberately not presented as valid EWF evidence images. Production E01/Ex01 operations use manifest-pinned `ewfinfo`, `ewfverify`, `ewfexport`, and `ewfacquire` from libewf; release builds must fail closed when those verified tools are absent.
