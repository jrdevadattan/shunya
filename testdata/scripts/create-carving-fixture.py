#!/usr/bin/env python3
import hashlib, json, pathlib, struct, sys

root = pathlib.Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
jpeg = b"\xff\xd8\xff\xe0" + b"JFIF\x00" + bytes(range(64)) + b"\xff\xd9"
pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"
payload = b"RECOVERY-CORPUS-v1\x00" + jpeg + bytes(4096 - len(jpeg)) + pdf
image = root / "carving-fixture.raw"
image.write_bytes(payload)
truth = {"fixtureId":"carving-basic-v1","imageSha256":hashlib.sha256(payload).hexdigest(),"artifacts":[{"artifactId":"carved_jpeg","originalPath":None,"sha256":hashlib.sha256(jpeg).hexdigest(),"expectedMethods":["carving"],"expectedState":"complete_validated"},{"artifactId":"carved_pdf","originalPath":None,"sha256":hashlib.sha256(pdf).hexdigest(),"expectedMethods":["carving"],"expectedState":"complete_validated"}]}
(root / "carving-fixture.truth.json").write_text(json.dumps(truth, sort_keys=True, indent=2) + "\n", encoding="utf-8")
