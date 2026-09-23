# 0009 - Leave an incomplete final bar incomplete

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

A block need not be a whole number of bars. A run of eight triplet eighths is
2.67 beats. An arpeggio measured in repeats is as long as its passes make it.
The final bar of such a block is part full.

Printed music does not do this. A bar is a bar; the last one is filled with
rests or the metre changes.

## Decision

The final bar stops where the block stops. No rests are added to pad it. The
block ends at a final double bar line.

## Why

A rest is a statement that there is silence there, and there is not - there is
nothing there, because the block has ended. If you insert a 2.67-beat block at
the cursor, the next thing starts 2.67 beats later, not at the next bar line.
Padding the bar with rests would draw a beat and a third of silence that is not
part of what you get.

Showing the bar stopping is the honest picture of a block that is not a whole
number of bars, and the double bar line at the end says so.

## Consequences

- The page is not a valid printed score. It is a picture of a block, which is
  what it is for.
- Someone reading it as a score may find the part-bar surprising. The final
  double bar is the cue.
- Bars that *are* complete but empty still get a proper measure rest, so the
  rule is specifically about the block's tail, not about empty bars in general.
