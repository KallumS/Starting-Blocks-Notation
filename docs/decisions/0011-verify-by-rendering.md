# 0011 - Verify the engraving by rendering it, not by reading it

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

The repository's testing culture is strong and explicit: pure modules, sweeps
over every block, and a rule that a test must be proved to bite by breaking
what it covers. That culture assumes the thing under test can be asserted.

Engraving only partly can. "The stem is on the right of the head" is an
assertion. "The clef looks like a clef" is not.

## Decision

`tools/preview_page.lua` renders real pages to SVG through the same pen
`sb_draw.lua` draws the window with (0003), and **looking at its output is a
required step**, not an optional one. Write the assertion afterwards for the
faults that can be asserted - most can - but look first.

## Why

This earned its place. Every significant fault in the engraving was found by
rendering and looking, and none of them failed a test that existed at the time:

- the treble clef was about two spaces too tall and spilled below the staff
- beamed stems were drawn twice - once to a guessed length, then again to the
  beam - leaving the guess on the page underneath
- beams followed the notes so closely they stood on end over a rising scale
- a chord's stem was measured from the near head, making a triad's stem half as
  long again as it should be
- the two staves of a great staff sat close enough to read as one ten-line staff

All five were obvious within a second of being on screen. Three of them now
have tests, written after the fact, because once you know what went wrong you
can usually say it as a comparison.

The tool is honest by construction: it is the real layout and the real glyph
code with four different functions at the end, so there is no second
implementation for it to flatter with. A preview that redrew the page from a
description would agree with the description rather than with the app.

## Consequences

- A change to `sb_draw.lua` should be rendered and looked at before it is
  committed, whatever the suites say.
- Rendering needs a Lua interpreter and, to view it, an SVG renderer. Neither
  is needed to run the app or the tests.
- Passing block names on the command line draws only those, which is what makes
  iterating on a single glyph bearable.
