# 0016 - The window's text follows Apple's writing guidelines

- **Date:** 2026-10-14
- **Status:** Accepted.

## Context

The user asked for every repository's on-screen words to follow Apple's
Human Interface Guidelines on writing, as Noterator and Miderator already do
(Noterator's decision 0053). This window is Starting Blocks' with a page of
notation in place of the roll, and Starting Blocks made the same change the
same day (its decision 0008).

## Decision

The same words as Starting Blocks, so the two windows still read alike:

- **Buttons, step headings and toggles** in title style: "Insert at
  Cursor", "Export MIDI File", "Scale Degree", "Building Block", and the
  page's own toggle, "Light Page".
- **Tooltips and status messages** in sentence case; a failure says what to
  do next ("No track is selected. Select a track, then insert again."), and
  nothing on screen says "buffer".
- **An em dash (—)** between phrases, curly apostrophes in sentences. Block
  names stay plain ASCII: they become file names.
- **Only labels change.** Stored values, the ExtState key and the engine,
  MIDI writer and placement files (Starting Blocks', byte for byte, 0001) are
  untouched; a word in them changes in Starting Blocks first.

## Consequences

- `tests/test_ui.lua` clicks "Light Page" by its new label.
- Nothing in the shared files changed, so the fork is still a copy of
  Starting Blocks there.
