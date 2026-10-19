#!/usr/bin/env python3
"""Refresh data/characters.json, data/nightsheet.json and data/jinxes.json from
the official Blood on the Clocktower toolmaker resources.

Source: https://github.com/ThePandemoniumInstitute/botc-release
Characters that only exist locally (homebrew) are kept as they are.
"""

import json
import re
import urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/ThePandemoniumInstitute/botc-release/main/resources/data/"
DATA = Path(__file__).resolve().parent.parent / "data"
OUT = DATA / "characters.json"

TEAMS = {"traveller": "traveler"}
FIELDS = [
    "name", "team", "edition", "ability", "flavor",
    "firstNightReminder", "otherNightReminder", "reminders", "remindersGlobal", "setup",
]


def norm_id(value):
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def fetch(name):
    with urllib.request.urlopen(BASE + name, timeout=30) as res:
        return json.load(res)


def write_json(path, data):
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    official = fetch("roles.json")

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
    night = fetch("nightsheet.json")
    write_json(DATA / "nightsheet.json", {
        "firstNight": [norm_id(x) for x in night["firstNight"]],
        "otherNight": [norm_id(x) for x in night["otherNight"]],
    })

    # Flatten to {character: {other character: reason}} in both directions.
    jinxes = {}
    for entry in fetch("jinxes.json"):
        a = norm_id(entry["id"])
        for j in entry["jinx"]:
            b = norm_id(j["id"])
            jinxes.setdefault(a, {})[b] = j["reason"]
            jinxes.setdefault(b, {})[a] = j["reason"]
    write_json(DATA / "jinxes.json", jinxes)

    print(f"wrote {len(chars)} characters ({len(kept)} kept from local data: {', '.join(kept) or 'none'})")


if __name__ == "__main__":
    main()
