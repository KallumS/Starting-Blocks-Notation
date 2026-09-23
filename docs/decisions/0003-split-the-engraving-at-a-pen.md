# 0003 - Split the engraving at a pen: one module decides, one inks

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

`CLAUDE.md` inherited a rule from the parent app: **ReaImGui lives in one
file**. That rule is what makes the UI testable - a mocked ImGui whose `__index`
raises on anything it does not have catches a call to a function ReaImGui does
not have, here rather than in REAPER.

An engraver is roughly 1,600 lines of layout and drawing. Putting it in the
window file keeps the rule and produces an unreadable file. Putting it in its
own file and letting it call `ImGui.` breaks the rule and makes every assertion
about a stem or a ledger line impossible to write.

## Decision

Two modules and a seam between them:

- `sb_notate.lua` decides **what is on the page and where**, in staff spaces,
  and returns it as values - a beam group, a stem direction, an accidental, an
  x position. It draws nothing and imports nothing.
- `sb_draw.lua` turns that into marks, but makes every mark through a **pen** it
  is handed: four calls, `line`, `poly`, `circle`, `text`. It contains no
  `ImGui.` and no `reaper.`.

Three pens exist. The window's is backed by a ReaImGui draw list.
`tests/test_draw.lua` hands it one that writes down every mark.
`tools/preview_page.lua` hands it one that writes SVG.

## Why

The seam buys three things at once, which is why it is worth a record.

It keeps the one-file rule intact through a feature that had every reason to
break it. It makes the engraving assertable: "the stem is on the right of the
head", "a dot is on a space, never a line", "nothing is drawn outside the
height the window reserved" are all ordinary comparisons on recorded marks.
And it makes `tools/preview_page.lua` honest - it renders the real page
through the real glyph code, so it cannot flatter the engraving, because there
is no second implementation for it to flatter with (0011).

Four calls was the smallest set that draws everything. Curves are sampled into
short `line` segments by `sb_draw.lua` itself rather than being a fifth pen
call, which keeps every pen trivial to write.

## Consequences

- A new glyph is a new function in `sb_draw.lua` using the existing four calls.
  If it seems to need a fifth, the answer is almost always sampling.
- Each pen must implement all four. Adding a call means editing three pens.
- The window's pen is where ReaImGui's awkwardness lives: a polygon goes
  through `reaper.new_array`, and text size needs `DrawList_AddTextEx`, which
  older ReaImGui builds lack and which is therefore feature-detected through a
  `pcall`. None of that reaches `sb_draw.lua`.
