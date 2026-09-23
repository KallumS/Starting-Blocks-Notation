# 0012 - Offer a light page, and turn over only the page

- **Date:** 2026-09-23
- **Status:** Accepted

## Context

The window is dark: a dark grey chrome, light grey controls, one yellow accent,
all of it recorded as settled in `CLAUDE.md`. The page inherited that and was
drawn near-white on near-black.

Notation has been black on white for five hundred years. A dark page is this
app's house style rather than the natural state of the thing, and it was asked
whether it could be the other way round.

## Decision

A **Light page** control on the line under the staff, saved between sessions,
off by default. It turns over the paper, the ink, the staff lines and the
accent - and nothing else. The window keeps its own chrome either way.

## Why only the page

A light page is a sheet of paper laid on the desk, not a second theme for the
app. Turning the whole window over would mean a second set of values for every
colour in `THEME`, a second answer to "is a chosen button readable", and a
second thing to check every time the scheme is touched. Nobody asked for a
light-grey control panel, and the page is the only part of this window that has
a five-hundred-year-old convention pulling the other way.

It is also the honest scope: the request was about reading the music.

## The accent

A saturated yellow is invisible on white, and the accent has a job here - it is
the one note an audition is inside (0008). The light page therefore uses the
**same yellow taken down by `shade()`**, the function that already makes the
hover and held states, rather than a fourth colour.

That keeps a settled scheme settled. Adding a colour would be a change of mind
about the three; deriving one is what the scheme already does everywhere else.

## Consequences

- The setting lives on `ui`, not in the engine's state table. The engine owns
  `st` and clamps every field in it, and a preference about paper is nothing to
  do with the engine - so `VIEW` is saved beside `SAVED` rather than smuggled
  into it. A flag needs no clamping: anything that is not the string this app
  wrote reads as false, which is also what settings written before this existed
  read as.
- `tests/test_ui.lua` drives both papers, including an audition on each, and
  asserts that everything drawn on the light page reads against it. That check
  is what stops the accent quietly reverting to the raw yellow, which looks
  fine in a diff and is invisible on screen.
- `tools/preview_page.lua --light` renders the light page, so it can be looked
  at the same way everything else in the engraving is (0011).
