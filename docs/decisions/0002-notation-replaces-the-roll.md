# 0002 - Notation replaces the roll; there is no grid view

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

The parent app draws a piano roll under the controls. The natural instinct when
adding notation is to keep the roll too - as a second pane, a tab, or a toggle -
because the roll answers questions notation answers slowly: how long is this
really, where exactly does that note sit, is this in time.

## Decision

The roll is gone and is not coming back. The window shows a staff and nothing
else. `pianoRoll()` was deleted rather than left unreachable.

## Why

The brief said notation *instead of* MIDI, and an app that shows both is the
app this one forked from with an extra pane.

There is also a substantive reason. Notation and a roll disagree in three
places on purpose - a note is written as its share of the bar (0005), a shuffle
is written straight (0006), and a part-bar is left part (0009). Showing both
puts those disagreements on screen next to each other with no way to explain
them, which reads as a bug three times over rather than as three decisions.

## Consequences

- Anything the roll was genuinely better at is lost. Gate length is the real
  one: you can no longer see that a chord stops nine tenths of the way through
  the bar. It is still in the exported MIDI, and the MIDI editor shows it.
- A request that amounts to "show the notes in a grid as well" is a request to
  undo the fork, and should be answered as such rather than implemented.
