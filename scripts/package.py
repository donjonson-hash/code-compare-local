"""Create deterministic installation and source ZIPs from the current build."""
import json
import hashlib
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
    "styles.css", "welcome.html", "welcome.css", "THIRD-PARTY-NOTICES.txt", "PRIVACY.md", "README.md", "README-RU.md",
)] + list((ROOT / "icons").glob("*.png")) + list((ROOT / "_locales").glob("*/messages.json"))
archive(f"code-compare-local-{version}-beta.zip", runtime)

excluded = {"node_modules", ".git", "dist", "test-output", "__pycache__"}
source = [file for file in ROOT.rglob("*") if file.is_file()
          and not excluded.intersection(file.relative_to(ROOT).parts)
          and file.suffix not in {".zip", ".bundle"}]
archive(f"code-compare-local-{version}-source.zip", source, "code-compare-local/")

archive(f"code-compare-local-{version}-test-files.zip",
        [f for f in (ROOT / "examples").rglob("*") if f.is_file()])

# Keep the store upload and the supporting materials in one delivery archive.
# The outer kit itself is not an installable extension.
store_files = {
    f"code-compare-local-{version}-beta.zip": (out / f"code-compare-local-{version}-beta.zip").read_bytes(),
    "icon128.png": (ROOT / "icons/icon128.png").read_bytes(),
}
for name in ("LISTING-EN.md", "SUBMISSION-RU.md", "screenshot-1280x800.png",
             "screenshot-fixed-1280x800.png", "screenshot-welcome-1280x800.png",
             "promo-440x280.png", "promo-1400x560.png", "KEYWORDS.md", "BOOTCAMP-CHECKLIST-RU.md", "LOCALIZATION-RU.md"):
    store_files[name] = (ROOT / "store" / name).read_bytes()
listing = store_files["LISTING-EN.md"].decode("utf-8")
description = listing.split("## Full description\n", 1)[1].split("\n## ", 1)[0].strip()
store_files["FULL-DESCRIPTION-EN.txt"] = (description + "\n").encode("utf-8")
store_files["descriptions/en.txt"] = (description + "\n").encode("utf-8")
metadata = {}
for path in sorted((ROOT / "_locales").glob("*/messages.json")):
    locale = path.parent.name
    messages = json.loads(path.read_text())
    metadata[locale] = {key: value["message"] for key, value in messages.items()}
    store_files[f"metadata/{locale}.json"] = path.read_bytes()
    if locale != "en":
        store_files[f"descriptions/{locale}.txt"] = (ROOT / "store/descriptions" / f"{locale}.txt").read_bytes()
store_files["LOCALIZED-METADATA.json"] = (json.dumps(metadata, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
for path in sorted((ROOT / "icons").glob("*.png")):
    store_files[f"icons/{path.name}"] = path.read_bytes()
store_files["SHA256SUMS.txt"] = "".join(
    f"{hashlib.sha256(data).hexdigest()}  {name}\n"
    for name, data in sorted(store_files.items())
).encode("utf-8")
kit = out / f"code-compare-local-{version}-store-kit.zip"
with ZipFile(kit, "w", compression=ZIP_DEFLATED) as zipped:
    for name, data in sorted(store_files.items()):
        entry = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        zipped.writestr(entry, data)
with ZipFile(kit) as zipped:
    assert zipped.testzip() is None
print(kit)
