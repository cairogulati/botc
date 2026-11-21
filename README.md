# BOTC Companion

A small companion site for our Blood on the Clocktower group: rules for new players, every script we play, a player-count setup guide and a random setup generator. It's a static site served by GitHub Pages.

## Adding a script

1. Upload the script sheet to `scripts/` as a PNG, JPG, WebP or PDF, e.g. `scripts/My-Script.png`.
2. Optionally upload the grimoire JSON with the same name, e.g. `scripts/My-Script.json`. Its `_meta.name` becomes the title shown on the site; otherwise the filename is used.
3. Push. The **Generate Scripts List** workflow rebuilds `data/scripts.json` and the thumbnails in `data/thumbs/`.

If a PDF and an image share a name, the PDF is the sheet and the image is used as its preview.

**Homebrew characters:** if a script JSON defines characters in full (objects with `id`, `name`, `team`, `ability`…, as the official script tool exports them), the workflow adds them to `data/characters.json` as Homebrew characters. They show in the Library (🧪 Homebrew filter), the random setup and the grimoire. If the script's `_meta` has `firstNight` / `otherNight` lists, the grimoire uses that night order for the script.

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
2. **Deal:** each player taps a face-down card, enters their name and sees their character, then hides it and passes the phone on. The Drunk, Lunatic and Marionette are shown the character they think they are: the Storyteller picks it in setup ("Who do they think they are?") or leaves it random, and can change it later from that player's seat in the grimoire.
3. **Grimoire:** the Storyteller opens it after a confirm.
   - **Circle:** reminder tokens for the characters in play sit in a tray above the circle. Tap one ("Poisoned", "Red Herring"…), then tap a player to place it; tap a placed reminder to remove it. Tap a seat to see its ability and jinxes, mark them dead, track their ghost vote, switch alignment, change their character or write notes. "Rearrange seats" swaps players so the circle matches the table, "＋ Traveller" adds a traveller, and "Town square" hides every character so you can show the table.
   - **Clock:** step through Night 1, Day 1, Night 2…
   - **Night:** the official wake order for tonight, with only the characters in play, who to wake (a Drunk shows under the character they think they are) and what to do. Tick steps off as you go.
   - **Votes:** record nominations and raised hands. It counts votes against the number needed, uses up ghost votes, shows who's on the block (ties mean nobody) and executes them.
   - **Info:** Demon bluffs, Fabled in play and the jinxes on this script.

The game is saved in the phone's browser, so refreshing the page doesn't lose it.

### 🎵 Musical Chairs variant

Turn on **Musical Chairs variant** in setup. Good characters live on the chairs, and evil characters stay with their player.

- **Setup:** pick one good character per player (one per chair), plus the evil team on top. With 7 players that's 7 good characters and 2 evil. 🎲 Random setup adds the extra Townsfolk for you. Characters that don't fit the variant (Snake Charmer, Pit-Hag, Lunatic, Marionette, Legion…) get a warning.
- **Deal:** card numbers are chair numbers. Good players see their chair's character. Evil players see their own character, plus the chair they're sitting on: that chair's character does nothing while they sit there, so they can claim it.
- **Music round:** at each dusk, tap 🎵 Music round in the grimoire. Record who sat in each chair, or let the site pick new seats so you can read them out. Dead players don't move. Good players become their new chair's character, and anyone who moved is marked 🎵 on the cards screen so they can check their new chair.
- **Night:** a player new to a "You start knowing…" character's chair (Washerwoman, Chef…) gets a step in that night's wake order to receive the info.
- **Grimoire:** each seat shows its chair number. The seat panel shows the chair's character and has a toggle for whether the chair's once-per-game ability is used, plus chair notes. Info → Seating log shows who sat where after every round.

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
