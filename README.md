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
3. **Grimoire:** the Storyteller opens it after a confirm.
   - **Circle:** tap a seat to see its ability and jinxes, mark them dead, track their ghost vote, switch alignment, add reminder tokens ("Poisoned", "Red Herring"…), change their character or write notes. "Rearrange seats" swaps players so the circle matches the table, "＋ Traveller" adds a traveller, and "Town square" hides every character so you can show the table.
   - **Clock:** step through Night 1, Day 1, Night 2…
   - **Night:** the official wake order for tonight, with only the characters in play, who to wake (a Drunk shows under the character they think they are) and what to do. Tick steps off as you go.
   - **Votes:** record nominations and raised hands. It counts votes against the number needed, uses up ghost votes, shows who's on the block (ties mean nobody) and executes them.
   - **Info:** Demon bluffs, Fabled in play and the jinxes on this script.

The game is saved in the phone's browser, so refreshing the page doesn't lose it.

## Characters

`data/characters.json` holds every character's name, team, ability, flavour text, Storyteller reminders and reminder tokens. `data/nightsheet.json` is the official night order and `data/jinxes.json` the official jinxes. They feed the Library tab, the script viewer, the random setup and the game. To refresh it from the official data (for example after new characters are released), run:

```
python3 tools/update_characters.py
```

Characters that only exist locally (homebrew) are kept. IDs are matched ignoring case, spaces, hyphens and underscores.

Character text © The Pandemonium Institute.

## Running locally

```
python3 tools/build_scripts.py   # needs Pillow; pdftoppm for PDF-only scripts
python3 -m http.server
```

Then open http://localhost:8000.
