# 2026-10-14 - The window's words to Apple's writing guidelines

## Asked

A sweep of every repository so the text on screen follows Apple's writing
guidelines, as was done for Noterator and Miderator (their 0053).

## Done (0016)

Made with Starting Blocks (its 0008), word for word where the windows share
a line: "Insert at Cursor", "Export MIDI File" (its button 120 to 140 pixels
wide), "Scale Degree", "Building Block", "Light Page"; status messages that
say what to do; em dashes in the tooltips; "buffer full" gone from the note
count, which reads "3 notes, 1.50 beats". The Light Page tooltip reads
"Only the page changes — the window keeps its own colours."

## Left alone, and why

- `sb_engine.lua`, `sb_midi.lua`, `sb_place.lua`: Starting Blocks' files,
  unchanged there too, so still copies.
- The engraver draws no words, so `tools/preview_page.lua`'s page is the same.

## Checked

`tools/test.sh`: every suite passes after `test_ui.lua` clicked "Light Page"
by its new name. `tools/preview.lua` before and after differs only in the
renamed labels.

## Not done yet

- Not run in REAPER; button widths are by estimate (the mock measures no
  text).
