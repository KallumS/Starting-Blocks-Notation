# 0007 - Choose the key signature by scoring, not by lookup

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

The app offers 16 scales on 21 roots. A key signature has to be printed for
every combination.

The obvious implementation is a lookup table from root and scale to a number of
sharps or flats. It answers correctly for Major and Minor. It has nothing to say
about the other fourteen, and two of them cannot be expressed as a signature at
all:

- **Harmonic minor** has a raised seventh that no signature contains. Every
  edition ever printed writes it in the natural minor's signature with the
  seventh as an accidental.
- **The diminished scales** spell two of their notes on the same letter - Ab and
  A natural both sit on A. No signature can hold both.

## Decision

`chooseSignature` scores all fifteen candidates from seven flats to seven
sharps against what the scale actually spells, +1 per letter that agrees and -1
per letter that disagrees, and takes the best. Ties go to the smaller signature,
then to the side the tonic leans.

## Why

Scoring gives the textbook answer everywhere a table would have - the eighteen
major and minor keys asserted in `test_notate.lua` all come out right - and the
defensible answer everywhere a table would have had none: the signature that
leaves the fewest accidentals on the page.

Harmonic minor is the case that proves it is doing work a table could not. A
minor scores 0 sharps because the raised seventh loses one point against every
candidate equally, and the G# becomes an accidental. That is the correct answer
and it falls out of the scoring rather than being special-cased.

The theoretical keys behave too. D# major would need nine sharps; it scores
seven and writes the remaining notes as double sharps.

## Consequences

- A signature is chosen for all 336 combinations and is always printable. A
  sweep asserts that.
- Some choices are defensible rather than canonical. C minor pentatonic comes
  out in two flats where an editor might write three; both leave no accidentals
  on the page, and the tie-break prefers the smaller.
- The rule lives in one pure function with no table to keep in step, so adding
  a scale to the engine needs nothing done here.
