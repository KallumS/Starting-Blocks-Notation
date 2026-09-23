# 0010 - Choose the staff once per block, not per note

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

A block can sit anywhere. A bass line two octaves down belongs on a bass staff;
a run in the fifth octave on a treble staff; a thirteenth chord voiced across
middle C needs both.

The obvious rule is per note: above middle C goes to the treble staff, below it
to the bass. That is what the great staff means.

## Decision

The choice is made once for the whole block, from its overall range:

- everything at or above middle C - one treble staff
- everything below middle C - one bass staff
- otherwise - a great staff, and then each note goes to its side

The kit is a percussion staff under the neutral clef, with cymbals and hi-hats
on crossed noteheads.

## Why

Per note alone would give a great staff to every block, including a melody that
happens to dip one note below middle C - a page half of which is an empty bass
staff. Worse, a run crossing middle C would hop staves in the middle of itself,
which is legal notation and unreadable as a preview of a small block.

Deciding from the range keeps the common cases on one staff, which is what most
blocks are, and reserves the great staff for the blocks that genuinely need it.

## Consequences

- A block that straddles middle C by one note still gets both staves. That is
  the right answer for a chord and slightly heavy for a melody; the alternative
  hops staves, which is worse.
- A bass line well below the staff gets ledger lines rather than an 8vb mark.
  Acceptable for a preview; an octave line is the obvious future improvement.
- The percussion map is a small table in `sb_notate.lua`. Pieces never sound
  together in this app - one block is one piece - so the positions only have to
  be recognisable, not mutually unambiguous.
