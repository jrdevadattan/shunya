# Demonstration fixtures

| Fixture | Purpose | Preparation |
|---|---|---|
| `ntfs-deleted-tree` | metadata recovery with original path | Generate in the Windows corpus VM; validate normalized truth JSON |
| `carving-basic-v1` | unnamed JPEG/PDF carving | run `create-carving-fixture.py` twice and compare hashes |
| `platform-test.yar` match | blocked unsafe preview | use only the committed harmless test rule |
| read-error virtual disk | ddrescue map/resume | attach a dedicated VM device-mapper or virtual disk, never host media |
| recorded Volatility JSON | processes/network tables | committed typed JSON fixture; no real user memory |

Before presenting, verify the repository commit, package/ISO checksums, available destination capacity, virtualization support, and that no real personal or evidentiary data is attached.
