# 0008 - Spend the accent on the sounding note, not on every note

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

The parent app's colour scheme is three colours - a dark ground, a light grey
for controls, one yellow for whatever is switched on - and `CLAUDE.md` records
them as **settled**, chosen deliberately and signed off.

Notes in the roll were drawn in that yellow. The rule was explicit, and so was
its safeguard: what kept a yellow note from reading as a selected button was
not hue but ground, the roll being far darker than the chrome. There was a test
asserting exactly that.

## Decision

The page is set in near-white ink on the dark paper. The accent is spent on one
thing: **the note the playhead is inside while an audition runs**.

## Why

A note in the roll was a rectangle. A note here is a notehead with a stem, a
hook, sometimes an accidental in front of it and a beam joining it to its
neighbours. Forty of those in a saturated yellow is not a page anyone can read
as music - the glyphs stop being glyphs and become texture.

Yellow still means what it meant: *this one, now*. There is one of it on the
page instead of forty, which is arguably a better use of an accent than the
original.

## Alternatives considered

Keeping every note yellow was tried in the first render and abandoned on sight.
Drawing the notes in yellow only on a lighter paper would have meant changing
one of the three settled colours, which is a bigger change than this one.

## Later

[0012](0012-offer-a-light-page.md) added a light page, where a saturated yellow
is invisible. The accent there is the same yellow taken down by `shade()`, so
there are two values for it and one rule: the accent marks the note an audition
is inside, on whichever paper is showing.

## Consequences

- This is a **deliberate departure from a rule marked settled**, and it is
  recorded here so it reads as a decision rather than as drift. It should be
  put to the owner of that scheme.
- The old test was rewritten, not deleted. It now holds the two properties that
  make the page legible - the music is far lighter than the paper, the paper is
  darker than the chrome - plus one that guards this decision directly:
  **nothing is drawn in the accent while nothing is playing**. That is the
  assertion that catches someone restoring the old rule from habit.
