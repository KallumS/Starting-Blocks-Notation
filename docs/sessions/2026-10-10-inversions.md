# 2026-10-10 - Every chord offers the inversions it has

The change was made in Starting Blocks (its decision 0007 and its session
log of the same day) and copied here: the engine byte for byte, the engine's
tests with it, the window's Inversion row, the panel test and the line in
`docs/BLOCKS.md`. Decision: [0015](../decisions/0015-a-chord-has-as-many-inversions-as-notes.md).

What was new here was the page. A thirteenth's sixth inversion reaches
higher than any chord did, so the height test now holds it three octaves up
and down, and the preview sheet draws a seventh, a ninth and a thirteenth in
their last inversions. The render was looked at, as 0011 asks; nothing in
the engraver needed to change.

The first render cut off the last chord. The page was fine: the screenshot's
window was shorter than the sheet.

Not done yet: not run in REAPER.
