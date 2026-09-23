# 2026-09-23 - A sharp under a notehead, and a light page

Two things, both from looking at the app running: a reported bug where an
accidental was drawn underneath the note it belonged to, and a request for the
page to be readable black on white.

---

## The bug: a sharp underneath its own notehead

**Reported as:** a screenshot of `C Major vi Chord 6/9`, five notes, one sharp
sitting behind a notehead.

Reproduced on the first try from the block name, which is the argument for
naming blocks the way this app does.

### What was actually wrong

Two faults, one on top of the other.

**The direction of a crossed head was worked out twice, and the two disagreed.**
Two heads a step apart cannot both sit on the same side of the stem, so the
upper one crosses it. `sb_notate.lua` decided which way with
`stem ~= "down"`, and `sb_draw.lua` decided again with `stem == "up"`. Those
agree about every note that has a stem and disagree about every note that does
not — and a whole note has no stem. So a whole-note chord drew its crossed head
to the left while the accidentals had been placed as though it had gone right.

The 6/9 chord is exactly that case: five notes, a second between E5 and F#5, a
whole bar so it is a whole note.

**The accidentals did not know about crossed heads at all.** They were laid out
from a running offset that started at one head-width left of the chord's x. A
head pushed across the stem sits *two* head-widths out, so even with the
directions agreeing there was nothing keeping the two apart.

### The fix

Placement moved out of the drawing and into the layout, which is where it
belonged: `M.placeHeads` now decides which side each head sits on, how far left
the chord's ink reaches, and which column each accidental goes in.
`sb_draw.lua` draws where it is told.

That made three things fall out:

- the direction is **one field**, `el.sideDir`, so the two modules cannot
  disagree again
- the accidental block starts left of the leftmost ink, crossed heads included
- accidentals pack into columns — near neighbours get separate columns, distant
  ones share one, instead of every accidental marching one step further left

The spacing pass now asks each element how much room its accidentals actually
need, rather than allowing a flat one-column width for any chord that has any.

### Tests

A sweep over five keys, four scales, every chord family, five degrees and both
stemmed and stemless chords — about 900 accidentals — asserting that **no
accidental overlaps a notehead it could reach**, plus a second sweep asserting
no two accidentals overlap each other, plus the 6/9 chord as a named
regression.

Four mutations, all caught: restoring the stem/no-stem disagreement, ignoring
the crossed head, collapsing every accidental into one column, and removing the
air between the accidentals and the heads.

**Why the original suite missed it.** The drawing tests asserted that a *single*
notehead's stem was on the correct side and that ledger lines appeared — real
properties, all of them true. Nothing asserted a relationship *between* two
different glyphs of the same chord. The engraving's hardest problems are all of
that shape, and there was not one test of that shape in the suite.

---

## The light page

**Asked for:** an option to invert the colours, black on white.

Done as a **Light page** toggle on the line under the staff, saved between
sessions, off by default. The reasoning is in
[0012](../decisions/0012-offer-a-light-page.md); the two decisions worth
repeating here:

**Only the page turns over.** The window keeps its own chrome. A light page is
a sheet of paper on the desk, not a second theme — and a second theme means a
second set of values for every colour in `THEME` and a second answer to every
question the scheme has already settled.

**The accent is the same yellow, shaded down.** A saturated yellow is invisible
on white, and the accent has a job — it marks the note an audition is inside.
Rather than add a fourth colour to a scheme recorded as settled, the light page
takes `shade(SELECTED, -0.42)`, which is what the hover and held states already
do.

The setting lives on `ui` and is saved in a `VIEW` list beside `SAVED`, not in
the engine's state table. The engine clamps everything in `st`, and a
preference about paper is nothing to do with the engine.

`tools/preview_page.lua --light` renders it, and it was checked by looking.

### Tests

Both papers driven through the window, including an audition on each, asserting
the tones invert, the chrome does not, the setting survives a save and reload,
settings written before the option existed still read as the dark page, and
**everything drawn on the light page reads against it**. That last one is what
would catch the accent quietly reverting to the raw yellow — a change that
looks harmless in a diff and is invisible on screen.

Six mutations, all caught. Two of them escaped a first draft of the test that
only reloaded from a written setting rather than clicking the control and
letting the app save it, which is a reminder that a test exercising the state
you wrote is not exercising the code that writes it.

---

## Where things stand

Full suite: 1,633 checks across six files, green.

The known gaps from the last session are unchanged — no 8vb, time-signature
figures are set rather than drawn, one metre per block, triplets only, no
slurs or dynamics.
