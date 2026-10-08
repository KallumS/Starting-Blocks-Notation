# 0013 - Bake Bravura's outlines into the script

- **Date:** 2026-10-08
- **Status:** Accepted. Supersedes the *drawing* in 0004, keeps its reason.

## Context

0004 drew every symbol from lines, circles and convex polygons because a
REAPER user cannot be counted on to have a music font, and a page of tofu
boxes is worse than a page of home-made clefs. That reason was right. What it
cost was the look: the glyphs were "good rather than beautiful", and set
beside Noterator - the family's JUCE notation app, which sets Bravura - the
difference was the first thing anyone noticed. The heads were round blobs,
the treble clef a thin wire, the time signature a sans-serif bold, the stems
and staff lines weighted by eye.

The objection in 0004 is to *loading a font file*. It is not an objection to
Bravura's shapes.

## Decision

Bravura's outlines travel inside the script as data. `tools/bake_glyphs.py`
reads the font once, flattens each symbol into polygons in staff spaces, and
writes them to `reascripts/sb_glyphs.lua`. `sb_draw.lua` fills those polygons
through the pen's existing `poly` call. The lines are still drawn, now to
Bravura's published engraving defaults.

To let one `poly` call carry a glyph, the pen's contract went from **convex**
to **simple and clockwise**, and the window's pen from
`DrawList_AddConvexPolyFilled` to `DrawList_AddConcavePolyFilled`, which is in
ReaImGui's 0.9 API - the version the script already asks for.

## Why

- **It is the same symbols as Noterator,** not an imitation of them. Drawing
  closer approximations by hand was the alternative, and the clef alone took
  0004 the most passes and still did not get there.
- **0004's reason survives intact.** No font is installed, loaded or looked
  up. What ships is two more Lua-side files beside the other five.
- **The seam survives intact (0003).** The glyphs are `poly` calls, so the
  test recorder, the SVG preview and the window needed nothing new to draw
  them, and every assertion about the page still sees every mark.
- **It removed the one inconsistency 0004 accepted.** The time signature's
  figures were text, and fell back to the window's font size on a ReaImGui
  without `DrawList_AddTextEx`. They are Bravura's figures now and scale with
  the staff everywhere.

## How the awkward parts were settled

- **Holes.** ReaImGui fills a simple polygon but not one with a hole. The bake
  cuts each glyph through its holes into pieces that overlap by a tenth of a
  space: cut flush, two anti-aliased edges meet in a visible seam; overlapped,
  each piece's solid interior covers the other's soft edge.
- **Winding.** Dear ImGui anti-aliases by pushing a fringe outward along each
  edge, and finds "outward" from the winding. Everything reaching the pen is
  clockwise on screen - baked that way, or turned by `fill()` - and the tests
  assert it.
- **Open noteheads** keep their exterior and their counter apart, because
  this app punches the counter with the paper colour (the staff line stops at
  the head's edge) and that is tested.
- **Licence.** Bravura is SIL OFL 1.1. Derived outlines stay under it, so
  `sb_glyphs.lua` carries the copyright notice and `sb_glyphs-OFL.txt` ships
  beside it. The OFL is explicit that bundling with software is fine and does
  not reach the software. The data is not called "Bravura", which is a
  Reserved Font Name.

## Consequences

- `sb_glyphs.lua` is generated, about 80 KB, and never hand-edited.
- The layout's widths now follow Bravura's: `HEAD_RX`, `WHOLE_RX`,
  `ACC_WIDTHS`, `ACC_CLEAR` (a seventh, for a sharp 2.8 spaces tall),
  `CLEF_WIDTH`, `SIG_STEP`, and a `timeWidth` that makes room for two figures.
- A flagged note now keeps its neighbour `FLAG_GAP` off, because Bravura's
  flag is a real flag and reached over the next head at the old spacing.
- Rebaking needs Python with `fonttools` and `shapely`, and the font file,
  which is not in this repository.
