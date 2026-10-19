#!/usr/bin/env python3
"""Refresh data/characters.json from the official Blood on the Clocktower role data.

Source: https://github.com/ThePandemoniumInstitute/botc-release
Characters that only exist locally (homebrew) are kept as they are.
"""

import json
import re
import urllib.request
from pathlib import Path

SOURCE = "https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main/resources/data/roles.json"
OUT = Path(__file__).resolve().parent.parent / "data" / "characters.json"

TEAMS = {"traveller": "traveler"}
FIELDS = ["name", "team", "edition", "ability", "flavor", "firstNightReminder", "otherNightReminder"]


def norm_id(value):
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def main():
    with urllib.request.urlopen(SOURCE, timeout=30) as res:
        official = json.load(res)

    existing = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}

    chars = {}
    for role in official:
        role = dict(role)
        role["team"] = TEAMS.get(role.get("team"), role.get("team"))
        entry = {k: role[k] for k in FIELDS if role.get(k)}
        chars[norm_id(role["id"])] = entry

    kept = [cid for cid in existing if cid not in chars]
    for cid in kept:
        chars[cid] = existing[cid]

    lines = [f"  {json.dumps(cid)}: {json.dumps(entry, ensure_ascii=False)}" for cid, entry in chars.items()]
    OUT.write_text("{\n" + ",\n".join(lines) + "\n}\n", encoding="utf-8")
    print(f"wrote {len(chars)} characters ({len(kept)} kept from local data: {', '.join(kept) or 'none'})")


if __name__ == "__main__":
    main()
