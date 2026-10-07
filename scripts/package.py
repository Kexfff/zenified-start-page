#!/usr/bin/env python3
"""Package the readable extension files for submission to Mozilla Add-ons."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main():
    root = Path(__file__).resolve().parent.parent
    manifest = json.loads((root / "manifest.json").read_text())
    files = ["manifest.json", "newtab.html", "app.js", "styles.css", "LICENSE"]
    files.extend(sorted(set(manifest["icons"].values())))
    for name in files:
        if not (root / name).is_file():
            raise FileNotFoundError(f"Missing extension file: {name}")

    output = root / "dist" / f"zenified-start-page-{manifest['version']}.zip"
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for name in files:
            archive.write(root / name, name)

    with ZipFile(output) as archive:
        assert archive.testzip() is None, "Archive integrity check failed"
        assert set(archive.namelist()) == set(files), "Unexpected archive contents"
        assert json.loads(archive.read("manifest.json")) == manifest

    print(f"Created {output} ({output.stat().st_size:,} bytes)")
    print("Included: " + ", ".join(files))


if __name__ == "__main__":
    main()
