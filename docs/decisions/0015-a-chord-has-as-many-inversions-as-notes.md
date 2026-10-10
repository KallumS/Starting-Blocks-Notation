# 0015 - A chord has as many inversions as it has notes, less one

- **Date:** 2026-10-10
- **Status:** Accepted.

## Context

The engine is Starting Blocks', copied byte for byte (0001), and the choice
was made there: its decision 0007. The Inversion row offered Root to 3rd on
every chord, so a triad's "3rd" repeated its 2nd and a ninth could never put
its 9th in the bass. The user set out the rule: a triad has two inversions,
a seventh three, and a ninth, eleventh or thirteenth one for each of its
notes after the root.

## Decision

The engine as Starting Blocks has it: `M.inversionCount`, `M.inversionNames`,
and `M.chordTones` putting the next note up the stack in the bass with the
notes under it lifted above it, in order. The window shows only the chord's
own inversions. The engine's tests came across with it.

## For the engraving

A thirteenth's sixth inversion is now the highest a chord reaches, so
`test_draw.lua` checks the page holds it three octaves up and three down, and
`tools/preview_page.lua` draws a seventh, a ninth and a thirteenth in their
last inversions. Looked at (0011): each stacks above its new bass, the heads
a second apart side by side as before.
