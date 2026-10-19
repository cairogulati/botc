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

## Game night (Game tab)

Everything runs on one phone that gets passed around the table.

1. **Setup:** the Storyteller picks the script and player count, then taps characters to select or deselect them, or uses 🎲 Random setup. The counters show the expected Townsfolk/Outsider/Minion/Demon split, including setup changes such as the Baron's. You can also use a random setup drawn in a script's Grimoire tab with "Use this setup for a game".
2. **Deal:** each player taps a face-down card, enters their name and sees their character, then hides it and passes the phone on. The Drunk, Lunatic and Marionette are shown the character they think they are.
3. **Grimoire:** the Storyteller opens it after a confirm. Tap a seat to rename the player, change their character, mark them dead, track their ghost vote and keep notes. It also suggests 3 Demon bluffs.

The game is saved in the phone's browser, so refreshing the page doesn't lose it.

## Characters

`data/characters.json` maps each character ID to its name and team (`townsfolk`, `outsider`, `minion`, `demon`, `traveler` or `fabled`). The random setup generator only draws characters it can find here, so add any new character a script uses. IDs are matched ignoring case, spaces, hyphens and underscores.

## Running locally

```
python3 tools/build_scripts.py   # needs Pillow; pdftoppm for PDF-only scripts
python3 -m http.server
```

Then open http://localhost:8000.
