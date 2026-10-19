# BOTC Companion

A small companion site for our Blood on the Clocktower group: rules for new players, every script we play, a player-count setup guide and a random setup generator. It's a static site served by GitHub Pages.

## Adding a script

1. Upload the script sheet to `scripts/` as a PNG, JPG, WebP or PDF, e.g. `scripts/My-Script.png`.
2. Optionally upload the grimoire JSON with the same name, e.g. `scripts/My-Script.json`. Its `_meta.name` becomes the title shown on the site; otherwise the filename is used.
3. Push. The **Generate Scripts List** workflow rebuilds `data/scripts.json` and the thumbnails in `data/thumbs/`.

If a PDF and an image share a name, the PDF is the sheet and the image is used as its preview.

## Setting tonight's script

Put one script filename per line in `current-script.txt`:

```
ThePlagueCourt.pdf
Trouble-Brewing.png
```

Optional settings lines in the same file:

```
# Regular game days (default: wed, sat)
days: wed, sat
# One-off game night; overrides `days` until the date has passed
date: 2026-10-22
```

Lines starting with `#` are ignored.

## Characters

`data/characters.json` maps each character ID to its name and team (`townsfolk`, `outsider`, `minion`, `demon`, `traveler` or `fabled`). The random setup generator only draws characters it can find here, so add any new character a script uses. IDs are matched ignoring case, spaces, hyphens and underscores.

## Running locally

```
python3 tools/build_scripts.py   # needs Pillow; pdftoppm for PDF-only scripts
python3 -m http.server
```

Then open http://localhost:8000.
