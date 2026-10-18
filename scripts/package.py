"""Create deterministic installation and source ZIPs from the current build."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / "manifest.json").read_text())["version"]
assert version == json.loads((ROOT / "package.json").read_text())["version"]
out = ROOT / "dist"
out.mkdir(exist_ok=True)


def archive(name, files, prefix=""):
    target = out / name
    with ZipFile(target, "w", compression=ZIP_DEFLATED) as zipped:
        for file in sorted(files):
            entry = ZipInfo(prefix + file.relative_to(ROOT).as_posix(), (2026, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            zipped.writestr(entry, file.read_bytes())
    with ZipFile(target) as zipped:
        assert zipped.testzip() is None
    print(target)


runtime = [ROOT / name for name in (
    "manifest.json", "background.js", "app.html", "app.js", "syntax-worker.js",
    "styles.css", "THIRD-PARTY-NOTICES.txt", "PRIVACY.md", "README.md", "README-RU.md",
)] + list((ROOT / "icons").glob("*.png"))
archive(f"code-compare-local-{version}-beta.zip", runtime)

excluded = {"node_modules", ".git", "dist", "test-output", "__pycache__"}
source = [file for file in ROOT.rglob("*") if file.is_file()
          and not excluded.intersection(file.relative_to(ROOT).parts)
          and file.suffix not in {".zip", ".bundle"}]
archive(f"code-compare-local-{version}-source.zip", source, "code-compare-local/")

archive(f"code-compare-local-{version}-test-files.zip",
        [f for f in (ROOT / "examples").rglob("*") if f.is_file()])
