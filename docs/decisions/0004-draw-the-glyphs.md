# 0004 - Draw the glyphs rather than depend on a music font

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

Music notation has a standard answer for glyphs: a SMuFL font such as Bravura.
One character per symbol, professionally drawn, correctly proportioned against
the staff. Every notation program uses one.

ReaImGui can load a font. The obstacle is that the user has to have it.

## Decision

Every musical symbol is drawn from primitives: clefs, noteheads, stems, hooks,
beams, rests, accidentals, ties, braces and dots. No font file ships and none is
required. The only text on the page is the time signature's figures and the
number over a tuplet, which are digits in whatever font the window has.

## Why

A REAPER user has no reason to have Bravura installed, and an app that looks
correct on the author's machine and wrong on everyone else's is worse than one
that draws its own. Shipping a font file with a ReaScript means telling people
to install it into the right folder, and the failure mode when they do not is
a page of tofu boxes.

Drawing also keeps the whole page in one coordinate system - staff spaces - so
a notehead and a beam and a ledger line are proportioned against each other by
construction rather than by matching a font's metrics to a staff size.

## Consequences

- The glyphs are good rather than beautiful. They were tuned by rendering and
  looking (0011); the treble clef took the most passes.
- They are resolution-independent and theme-independent, which a font bitmap
  would not be, and they recolour with the rest of the page for free.
- Time signature figures are the one inconsistency: they are set, not drawn, so
  on a ReaImGui without `DrawList_AddTextEx` they fall back to the window's font
  size instead of scaling with the staff. Everything else is unaffected, which
  is why this was accepted rather than solved by drawing ten digits.
