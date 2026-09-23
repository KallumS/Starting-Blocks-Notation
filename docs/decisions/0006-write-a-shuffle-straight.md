# 0006 - Write a shuffle straight and let the block's name carry it

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

The drum panel has a **shuffle** control: a percentage that pushes every second
hit later, up to a third of the way to the next one. It is a continuous value,
not a triplet feel with a name.

Before this decision, a shuffled bar of sixteenths engraved as **sixteen
quarter notes**. Every onset was off the binary grid, so no duration matched a
note value, every one fell through `M.split`, and every one hit the fallback.

## Decision

Onsets are snapped back to the grid the block was generated on before anything
else happens. `M.gridFor` says which grid that is - the drum step, the chord's
chop, or the panel's rate. The swing is carried by the block's own name, which
already reads "Drum Kick 1/16 shuffle 40".

The snap is safe because the offset is never a whole step, so two hits can
never legitimately land on one; the code keeps them apart if rounding ever puts
them there.

## Why

This is what printed music does. A swung passage is written straight and marked
at the top, because no note value names "a third of the way to the next one"
and writing it as triplets says something different about the rhythm.

The app already has a separate Triplet feel on `rateMod`. If shuffle were
engraved as triplets, two distinct controls would produce the same page.

## Consequences

- **The MIDI is unchanged.** The exported hits are shuffled exactly as before.
- The page cannot show you *how much* shuffle is applied, only that some is.
  The name carries the number, which is where a reader of printed music would
  expect to find it.
- A test asserts a shuffled bar of sixteenths is sixteen plain sixteenths -
  not dotted, not triplets. Removing the snap produced 32 failures.
