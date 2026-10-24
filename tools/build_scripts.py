#!/usr/bin/env python3
"""Build data/scripts.json and data/thumbs/ from the files in scripts/.

One entry per script name (case-insensitive). A PDF wins over an image with
the same name, and that image becomes the PDF's preview. Titles come from the
script JSON's _meta.name when there is one.
"""

import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = ROOT / "scripts"
DATA_DIR = ROOT / "data"
THUMBS_DIR = DATA_DIR / "thumbs"
CURRENT_FILE = ROOT / "current-script.txt"
CHARACTERS_FILE = DATA_DIR / "characters.json"

# Fields copied from a homebrew character defined inside a script JSON.
HOMEBREW_FIELDS = [
    "name", "team", "ability", "flavor",
    "firstNightReminder", "otherNightReminder", "reminders", "remindersGlobal", "setup",
]

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
THUMB_WIDTH = 480
THUMB_QUALITY = 72


def norm_id(value):
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def slugify(stem):
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "script"


def title_from_filename(stem):
    return re.sub(r"\b\w", lambda m: m.group(0).upper(), stem.replace("-", " ").replace("_", " "))


def read_current_keys():
    if not CURRENT_FILE.exists():
        return []
    keys = []
    for line in CURRENT_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        # Skip blanks, comments and "key: value" settings such as "date: 2026-10-22".
        if not line or line.startswith("#") or re.match(r"^[a-z]+\s*:", line, re.I):
            continue
        keys.append(Path(line).stem.lower())
    return keys


def load_script_json(path):
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        print(f"warning: could not read {path.name}: {err}")
        return None
    return data if isinstance(data, list) else None


def roles_from(data):
    roles = []
    for item in data or []:
        raw = item.get("id") if isinstance(item, dict) else item
        if not isinstance(raw, str) or raw == "_meta":
            continue
        rid = norm_id(raw)
        if rid and rid not in roles:
            roles.append(rid)
    return roles


def meta_from(data):
    for item in data or []:
        if isinstance(item, dict) and item.get("id") == "_meta":
            return item
    return {}


def homebrew_from(data):
    """Characters defined in full inside a script (anything but _meta with a name and team)."""
    found = {}
    for item in data or []:
        if not isinstance(item, dict) or item.get("id") in (None, "_meta"):
            continue
        if item.get("name") and item.get("team"):
            entry = {k: item[k] for k in HOMEBREW_FIELDS if item.get(k)}
            entry["team"] = {"traveller": "traveler"}.get(entry["team"], entry["team"])
            entry["edition"] = "homebrew"
            found[norm_id(item["id"])] = entry
    return found


def night_order(meta, key):
    return [norm_id(x) for x in meta.get(key) or [] if isinstance(x, str)]


def write_characters(homebrew):
    """Add homebrew characters to data/characters.json without touching official ones."""
    chars = json.loads(CHARACTERS_FILE.read_text(encoding="utf-8")) if CHARACTERS_FILE.exists() else {}
    changed = False
    for cid, entry in homebrew.items():
        existing = chars.get(cid)
        if existing and existing.get("edition") != "homebrew":
            continue  # official character with the same ID wins
        if existing != entry:
            chars[cid] = entry
            changed = True
    if changed:
        lines = [f"  {json.dumps(cid)}: {json.dumps(e, ensure_ascii=False)}" for cid, e in chars.items()]
        CHARACTERS_FILE.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")
    print(f"homebrew characters: {len(homebrew)} found, characters.json {'updated' if changed else 'unchanged'}")


def make_thumb(source, dest):
    if source.suffix.lower() == ".pdf":
        if not shutil.which("pdftoppm"):
            print(f"warning: pdftoppm missing, no thumbnail for {source.name}")
            return False
        with tempfile.TemporaryDirectory() as tmp:
            prefix = Path(tmp) / "page"
            subprocess.run(
                ["pdftoppm", "-png", "-f", "1", "-l", "1", "-scale-to-x", str(THUMB_WIDTH * 2),
                 "-scale-to-y", "-1", str(source), str(prefix)],
                check=True,
            )
            page = next(Path(tmp).glob("page*.png"))
            return make_thumb(page, dest)

    with Image.open(source) as img:
        img = img.convert("RGB")
        if img.width > THUMB_WIDTH:
            height = round(img.height * THUMB_WIDTH / img.width)
            img = img.resize((THUMB_WIDTH, height), Image.LANCZOS)
        img.save(dest, "WEBP", quality=THUMB_QUALITY, method=6)
    return True


def main():
    groups = {}
    for path in sorted(SCRIPTS_DIR.iterdir()):
        if not path.is_file():
            continue
        groups.setdefault(path.stem.lower(), []).append(path)

    current_keys = read_current_keys()
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)
    wanted_thumbs = set()
    entries = []
    homebrew = {}

    for stem, files in groups.items():
        by_ext = {}
        for f in files:
            by_ext.setdefault(f.suffix.lower(), f)

        pdf = by_ext.get(".pdf")
        image = next((by_ext[e] for e in (".png", ".webp", ".jpg", ".jpeg") if e in by_ext), None)
        main_file = pdf or image
        if not main_file:
            continue

        json_path = by_ext.get(".json")
        data = load_script_json(json_path) if json_path else None
        meta = meta_from(data)
        title = (meta.get("name") or "").strip() or title_from_filename(main_file.stem)

        thumb_name = f"{slugify(main_file.stem)}.webp"
        thumb_path = THUMBS_DIR / thumb_name
        has_thumb = make_thumb(image or pdf, thumb_path)
        if has_thumb:
            wanted_thumbs.add(thumb_name)

        entry = {
            "title": title,
            "file": main_file.relative_to(ROOT).as_posix(),
        }
        if pdf and image:
            entry["preview"] = image.relative_to(ROOT).as_posix()
        if has_thumb:
            entry["thumb"] = thumb_path.relative_to(ROOT).as_posix()
        entry["json"] = json_path.relative_to(ROOT).as_posix() if data is not None else None
        if meta.get("author"):
            entry["author"] = meta["author"]
        entry["roles"] = roles_from(data)
        for key in ("firstNight", "otherNight"):
            order = night_order(meta, key)
            if order:
                entry[key] = order
        homebrew.update(homebrew_from(data))
        entry["current"] = stem in current_keys
        entries.append(entry)

    for old in THUMBS_DIR.glob("*.webp"):
        if old.name not in wanted_thumbs:
            old.unlink()

    entries.sort(key=lambda e: e["title"].lower())
    out = DATA_DIR / "scripts.json"
    out.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} with {len(entries)} scripts")
    write_characters(homebrew)


if __name__ == "__main__":
    main()
