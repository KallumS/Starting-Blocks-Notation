# 0005 - Notate a note as its share of the bar, not its gated length

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

Every block leaves the engine **gated**: a note sounds for a percentage of its
slot and stops, so a repeated chord is heard as separate strikes rather than as
one held sound. The default gate is 90%.

The first version of the engraver notated the length the engine produced. A
triad set to fill a four-four bar came out as a quarter note, because 90% of a
bar is 3456 ticks, which is not a whole note and not anything else either. Once
the value table was consulted honestly it would have been a tied
63/64ths-and-a-rest.

## Decision

A note's **notated** duration is the distance from its onset to whatever starts
next, or to the end of the block for the last one. The gated length is ignored
by the engraver. `events()` in `sb_notate.lua` does this.

Percussion is capped at one bar, because a drum does not sustain and a lone
crash in an eight-bar block should be a hit and then silence rather than eight
bars of tied whole notes.

## Why

Gate is a performance property, not a rhythmic one. A performer reading a bar
of quarter notes plays them detached or not according to the music; nobody
writes 90% durations down. Notating the gate literally produces a page that is
arithmetically faithful to the MIDI and useless as music.

This is the first of the three places the page deliberately disagrees with the
MIDI, and the one most likely to be "fixed" by someone who finds it by reading
the code rather than by looking at a page.

## Consequences

- **The MIDI is unchanged.** Export, insert and audition all still carry the
  gate. This is the notation's business only.
- You can no longer see the gate. That is the cost of 0002, and it is the
  MIDI editor's job once the block is in the project.
- A test asserts the whole-bar triad is a whole note, and a sweep asserts every
  measure of every block is filled exactly. Both fail loudly if someone
  reintroduces the gated duration - the sweep alone produced 57 failures when
  this was tried as a mutation.
