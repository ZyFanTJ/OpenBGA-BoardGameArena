# CABO audio credits

Retrieved from the authors' official distribution pages on 2026-10-31.
Runtime files are in `apps/web/assets/cabo/audio/` (about 2.72 MB total).

## Background music

**Happy-Go-Lucky Puzzle — Axton Crolley**

- Source: https://opengameart.org/content/happy-go-lucky-puzzle
- Original download: https://opengameart.org/sites/default/files/periwinkle_0.mp3
- License: Creative Commons Attribution-ShareAlike 3.0 Unported, https://creativecommons.org/licenses/by-sa/3.0/
- Local file: `periwinkle.mp3`, original audio unchanged (renamed only), 107.65 seconds.
- Attribution and license links are visible in the game's sound settings.
- The original file is repeated with HTML audio looping; this is not advertised as a seamless musical loop.
- If an adapted recording is distributed later, preserve attribution and license the adaptation under the required compatible ShareAlike terms.

## Sound effects

**Kenney**, CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
Included original license notices: `Kenney-Casino-License.txt`, `Kenney-Interface-License.txt`, `Kenney-Jingles-License.txt`.
Only the selected sounds are shipped; converted from OGG to MP3 with FFmpeg libmp3lame quality 4 for browser compatibility. No trimming or pitch changes.

| Source | Original file | Use |
| --- | --- | --- |
| https://kenney.nl/assets/casino-audio | card-shuffle.ogg | Deal |
| Casino Audio | card-slide-1.ogg | Draw |
| Casino Audio | card-place-1.ogg | Discard / successful exchange |
| Casino Audio | card-shove-1.ogg | Look / cover |
| Casino Audio | card-slide-4.ogg | Swap |
| https://kenney.nl/assets/interface-sounds | click_001.ogg | Select a card |
| Interface Sounds | glass_001.ogg | Peek |
| Interface Sounds | glass_002.ogg | Spy |
| Interface Sounds | error_001.ogg | Failed exchange |
| https://kenney.nl/assets/music-jingles | jingles_PIZZI01.ogg | Call CABO |
| Music Jingles | jingles_PIZZI09.ogg | Round / match result |
| Music Jingles | jingles_PIZZI10.ogg | Local player wins match |

## Behavior

Music and effects have independent persistent local toggles and volume sliders (22% / 55% defaults). Audio starts after interaction with the table. No audio is downloaded before that interaction. Background tabs pause music and stop effects; leaving the game disposes playback and listeners. Playback failures do not block play.

Effects use the animation's accepted, contiguous displayed snapshots and player view. Duplicates, first render, resync, revision gaps and hidden-tab updates are silent. Reduced motion still allows sound. Sound selection does not inspect hidden card values. Game rules and persisted game state are unchanged.
