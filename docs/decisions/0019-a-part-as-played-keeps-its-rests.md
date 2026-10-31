# 0019 - A part handed over as played keeps its rests

- **Date:** 2026-10-31
- **Status:** Accepted. Extends 0005 for one caller; the window is unchanged.

## Context

0005 writes every note up to whatever starts next, because a block leaves
the engine gated: a chord sounding nine tenths of a bar is a whole note, and
notating the gate would put a tied 63/64ths and a rest where a whole note
belongs. That is right for blocks.

Middaw (the user's DAW) engraves its own clips with this engraver. A clip is
not a gated block: its notes are as somebody played or wrote them, and a
silence inside a phrase is part of the music. Under 0005 a quarter, an eighth
and an eighth's rest printed as two quarters - the rest became a longer note.

## Decision

`N.layout` takes `opts.rests`. With it, a note is written to where its sound
stops, **rounded up** to a grid (`opts.restGrid`, a sixteenth by default), and
a rest is written only when at least one step of that grid is left before the
next onset. The rests then fill the gap the way they already filled the start
and end of a block.

Rounding up is the part that matters. A note sounding 82-98% of its slot - the
range Middaw's composer writes - reaches the end of its slot, so articulation
does not become a scatter of sixteenth rests. Rounding to the nearest would
have turned every detached quarter into a dotted eighth and a sixteenth rest.

Without `opts.rests` nothing changes, and the window does not pass it: its
pages are still blocks, gated, written per 0005.

## Consequences

- Tests: a silence inside a phrase is a rest where it falls (fails on the old
  engraver); without the option the note still runs to the next onset;
  82-97% notes take no rests; at the engine's own 90% gate the option changes
  no page in a sweep of blocks; and with it every measure is still filled
  exactly at gates from 20% to 100%.
- A block gated very short (the Gate slider at 20%, say) shows rests with the
  option on. That is the option's meaning: as played. The window does not ask
  for it.
