# Session log - 16 to 21 October 2026: the final HIG sweep (1.2)

Asked across the family: a final sweep of the 19 Foundations pages. Done
alongside Starting Blocks 2.5, whose window changes this one takes word for
word; the table is in [`../apple-hig-review.md`](../apple-hig-review.md), the
decision in [0017](../decisions/0017-apples-hig-foundations.md)'s dated section.

## What changed

- The window: everything in Starting Blocks 2.5's log - raised menus and
  tooltips, house greys for ImGui's defaults, shortcut keys 7:1, edges on
  slider tracks and the Loop box, rows and words that wrap, a minimum size,
  Escape letting go first, the block's name in the title, tooltips for the
  sliders and Loop. The Light Page button and the note count share a wrapping
  row.
- The page: Light Page `#F5F7FA` -> `#E8EBEF`; its staff lines `#99A2B0`
  (2.4:1, a failure) -> `#6E7683`; its accent `-0.42` -> `-0.45` (2.9:1 on the
  new paper would have failed). `tools/preview_page.lua --light` follows (its
  accent was a stale `#A69A00`).
- `sb_draw.lua`: a wedge in the accent over the sounding note, in the room
  above the system, so it is not told by colour alone.

## Checks

`tools/test.sh` passes. The UI test's mock gained the same ruler as Starting
Blocks', plus a record of what is drawn on the page so the paper, ink, staff
and accent can be measured. A first version of that record kept a flag from
the frame before and took a button's ink bar for the paper; it is reset each
frame now. Sabotages: see the commit.

## Not done

Not run in REAPER: the tooltip for the focused control, the first Escape, the
minimum size, and how the off-white page looks on a real screen.
