# 2026-09-22 - The notation offshoot

**Brief:** take Starting Blocks, make an offshoot with the same functionality
that displays notation instead of MIDI. The plugin still exports MIDI into
REAPER; nothing in the app shows a piano roll.

**Outcome:** done and pushed to `claude/starting-blocks-notation-pqvhr1`.
9,144 lines across 21 files, of which about 3,000 are new - the rest is the
parent app carried over unchanged. Six suites, 1,593 checks, green.

Attached to the brief was Gehrkens, *Music Notation and Terminology* (1914),
from Project Gutenberg. It is the source for every convention the engraver
follows, cited by section in the code.

---

## What was built

Starting Blocks is a ReaScript: a ReaImGui window, a pure engine that generates
blocks, a MIDI writer, and a file that touches REAPER. It draws a piano roll
under the controls.

The offshoot keeps four of those files byte-identical and replaces the roll:

| | |
| --- | --- |
| `sb_notate.lua` | New. The engraver: a block in, a page out, in staff spaces. Pure. |
| `sb_draw.lua` | New. The ink, drawn through a pen of four calls. No ImGui in it. |
| `tests/test_notate.lua` | New. 268 checks. |
| `tests/test_draw.lua` | New. 63 checks. |
| `tools/preview_page.lua` | New. Renders real pages to SVG without REAPER. |
| `Starting Blocks Notation.lua` | Renamed, retitled, new ExtState section; `pianoRoll` swapped for `notation`. |
| `sb_engine.lua`, `sb_midi.lua`, `sb_place.lua` | Carried over. `sb_place` gained one function, `M.cursor()`. |

Eleven decisions worth recording came out of it; they are in
[`docs/decisions/`](../decisions/README.md) and the rest of this log assumes
them rather than re-arguing them.

---

## How it went

### Reading the ground first

The parent repo's `CLAUDE.md` is unusually good - it records not just what the
code does but which arguments have already been settled and which mistakes have
already been made twice. Two of its rules shaped the whole session: **ReaImGui
lives in one file**, and **prove a test bites before believing it**.

The first looked like it would have to break. An engraver is too big for the
window file and needs to draw. The way out was the pen (0003), which turned out
to buy more than it cost - it is also what makes the drawing testable and what
makes the SVG tool honest.

### The engraver came together quickly, then three real bugs

Layout was written in one pass and smoke-tested against real blocks
immediately, which caught three things in the first ten minutes:

**A whole-bar triad engraved as a quarter note.** The engine gates notes to 90%
of their slot, and I was notating the gated length. This became 0005 - a note
is written as its share of the bar.

**Odd bars over-fragmented.** My first splitting rule refused to let a note
cross a metric boundary coarser than its own onset alignment, which is a rule
that sounds right and is wrong about printed music: a half note on the second
beat of a three-four bar is a half note. `M.split` now writes a duration with
one symbol wherever it falls and only decomposes durations that have no symbol.

**A shuffled bar of sixteenths engraved as sixteen quarter notes.** Every onset
was off the grid, so every duration fell through the splitter to the fallback.
This became 0006 - snap to the block's own grid and let the name carry the
swing.

The third one also exposed that my fallback could reach for a double-dotted
triplet sixteenth. Dotted triplets are now excluded from the value set: they
are real, nothing here can generate one, and leaving them in only gave the
fallback rope.

### The drawing needed eyes, not tests

This is the part worth remembering (0011). The layout was assertable and the
tests found real problems. The *drawing* was not, and the tests found nothing,
because I had not thought to assert the things that were wrong.

I built an SVG pen, rendered a sheet of sixteen representative blocks, and
looked at it. In four rendering passes:

1. **The treble clef was two spaces too tall** and trailed below the staff. It
   read as a squiggle. Rebuilt from proper proportions, twice.
2. **Every beamed stem was drawn twice** - once to a guessed length in `chord`,
   then again to the real beam - leaving the guess visible underneath.
3. **Beams stood on end** over a rising scale. My slant was 55% of the interval;
   engraving practice is about a quarter, capped near a space.
4. **A triad's stem was half as long again as it should be**, because I measured
   from the near head rather than the far one.
5. **The two staves of a great staff read as one ten-line staff.** The gap was
   2.2 spaces; it is now 4.6.

None of these failed a suite at the time. Three of them have tests now, written
afterwards, because once you know what went wrong you can usually say it as a
comparison.

A mid-session scare that turned out to be nothing: a stray double bar line
appeared next to the clef in every key-signature example. I dumped the actual
draw calls rather than squinting further, and it was my test sheet's two
columns overlapping. Worth noting because the instinct to start "fixing" it
was strong and would have broken something that was correct.

### Proving the tests bite

Both new suites passed first run, which the repo's own guidance says to
distrust. I mutated thirteen behaviours and checked each one failed.

Eleven did. **Two did not**, and both were real gaps:

- **The accidental check was backwards.** It asserted an accidental is not
  written *twice* on one degree in a bar - which passes happily on a version
  that marks *every single note*, because a run rarely repeats a degree inside
  one bar. The assertion that bites is the opposite: a scale written in its own
  key wears no accidentals at all, because the signature has already said them.
  Six keys are checked that way now; the mutation goes from 0 failures to 33.
- **The notehead check covered the whole note's hole and not the half note's.**
  They are drawn by different branches, so deleting one failed nothing. Both
  are checked now.

Both are recorded in `CLAUDE.md` alongside the four gaps the parent app found
the same way.

---

## Decisions that needed judgement

Two are worth flagging to a human rather than leaving in the record.

**The accent no longer paints the notes** (0008). The parent app's three
colours are marked *settled* in `CLAUDE.md`, and one of them was explicitly
spent on notes. A page of yellow noteheads, stems, hooks and accidentals is not
readable as music, so the page is set in ink and the yellow is spent on the one
note an audition is inside. I rewrote the test to guard the new rule rather
than deleting it. **This is a departure from something signed off and should be
put to whoever signed it off.**

**No staff-size control.** The staff space is fixed at 10 pixels. A zoom
control is defensible for a notation app, but it is a UI-only setting and the
engine owns the state table and its clamps, so it would need somewhere new to
live. Left out rather than done badly.

---

## Known gaps

Not bugs, but the honest list of what a notation app would want next:

- **No 8vb/8va.** A bass line two octaves down gets ledger lines instead.
- **Time signature figures are set, not drawn**, so they need
  `DrawList_AddTextEx`; on older ReaImGui they fall back to the window's font
  size. Everything else on the page is drawn and unaffected.
- **Only the project's signature at the cursor is read**, once per rebuild. A
  block spanning a metre change is written in one metre.
- **Tuplets are triplets only**, which is all the engine can generate.
- **No slurs, dynamics or articulations**, which is consistent with the parent
  app deliberately having no velocity control.

---

## For whoever picks this up

Run `tools/test.sh` first; it needs `lua5.4` or `lupa`.

If you touch `sb_draw.lua`, render before you commit:

```
lua5.4 tools/preview_page.lua > page.svg
```

and pass block names to draw only those. That habit found five faults in one
session that the suites did not.

If you touch the four carried-over files, remember they are meant to stay
identical to upstream (0001) - tidying them here turns every future upstream
fix into a merge conflict.
