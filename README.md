# Starting Blocks Notation

A catalogue of the smallest useful pieces of music - chords, arpeggios, runs,
melodic steps, leaps and held notes, bass notes, single drum hits - that you
pick by key, scale and scale degree, **read as notation**, and then drop into a
REAPER project.

The idea is that a song starts from parts, not from a blank arrange. Pick a
key. Pick a degree of it. Then pull in the block you want and keep going.

This is [Starting Blocks](https://github.com/KallumS/Starting-Blocks) with the
piano roll taken out and an engraver put in. Everything about what a block *is*
is the same - the same keys, the same scales, the same 78 chords, the same
generators, the same note-for-note output. What changed is that you read the
block on a staff instead of looking at it as bars in a grid.

**What leaves for REAPER is still MIDI.** Insert, Export and Audition are
unchanged: a block goes into the project as a MIDI item, writes out as a `.mid`
and plays through the virtual keyboard exactly as before. The notation is how
you read a block, not what you get.

| | |
| --- | --- |
| `reascripts/Starting Blocks Notation.lua` | The script you run. The window, and getting blocks into the project. |
| `reascripts/sb_engine.lua` | The music: keys, scales, chords, generators. No REAPER in it. |
| `reascripts/sb_notate.lua` | The engraver. A block in, a page out. No drawing in it. |
| `reascripts/sb_draw.lua` | The ink: clefs, noteheads, stems, beams, rests. |
| `reascripts/sb_midi.lua` | Writing a block out as a standard MIDI file. |
| `reascripts/sb_place.lua` | Everything that touches REAPER: inserting, exporting, auditioning. |
| `docs/BLOCKS.md` | Every block it can make. Generated from the engine. |

The keys, scales and note spelling are
[ScaleView for REAPER](https://github.com/KallumS/ScaleView-for-Reaper)'s,
unchanged, so the apps agree on what a scale is and on what to call its notes.
F# major spells its seventh E#, here as there - and now you can see it do so.

## Installing

It installs beside the original rather than over it: different file names, and
its own saved settings. Having both is fine.

**1. Install ReaImGui.** The script will not start without it.

In REAPER: Extensions -> ReaPack -> Browse packages, search for `ReaImGui`,
right-click it and Install. Then Extensions -> ReaPack -> Apply changes, and
restart REAPER.

If you have no ReaPack, get it from [reapack.com](https://reapack.com), put the
file it gives you in `UserPlugins` inside the resource path below, restart, and
then do the above.

**2. Put all six files in one folder under Scripts.**

Options -> Show REAPER resource path in explorer/finder, then into `Scripts/`.
Make a folder and put these six in it together:

```
Scripts/Starting Blocks Notation/
  Starting Blocks Notation.lua
  sb_engine.lua
  sb_notate.lua
  sb_draw.lua
  sb_midi.lua
  sb_place.lua
```

They have to be in the same folder. `Starting Blocks Notation.lua` loads the
other five from wherever it is itself, so splitting them up stops it working.

The resource path is `%APPDATA%\REAPER` on Windows,
`~/Library/Application Support/REAPER` on macOS and `~/.config/REAPER` on Linux.

**3. Load it as an action.** Actions -> Show action list -> New action ->
Load ReaScript, and pick `Starting Blocks Notation.lua`. It turns up in the
action list, where you can run it, give it a shortcut, or right-click a toolbar
button to put it there.

It is a toggle, so running the action again closes the window. Escape closes it
too.

### If something goes wrong

**It says it needs ReaImGui.** The extension is not installed, or REAPER has
not been restarted since it was.

**It errors on the line that loads ReaImGui.** Your ReaImGui is older than the
version the script asks for. Either update it, or change `dofile(imgui_path)("0.9")`
near the top of `Starting Blocks Notation.lua` to the version you have.

**It cannot find `sb_engine.lua`.** The six files are not in the same folder.

**The time signature is the wrong size.** Your ReaImGui has no
`DrawList_AddTextEx`, so the figures fall back to the window's own font size.
Everything else on the page is drawn rather than set, so nothing else changes.

**Audition makes no sound.** It plays through REAPER's virtual MIDI keyboard,
so it needs a track that is record-armed with input monitoring on, holding an
instrument. Insert, Place and Export do not need any of that.

## Using it

**Key** across the top, then **Scale**, then the **Scale Degree** as a Roman
numeral. The numerals are cased and marked for the chord the scale actually
builds on that degree, so the vii of major reads `vii°` and the III of natural
minor reads `III`.

Then pick what kind of block you want - **Chord**, **Arpeggio**, **Run**,
**Melody**, **Bass**, **Drums** - and only that block's options are on screen.
The staff underneath is whatever you have currently built.

Arpeggios and bass notes read the chord you set in the Chord tab, so there is
one chord picker rather than three.

Chords, bass and drums are measured in **bars**, from a quarter of one up to
eight - a single chord stab is a quarter-bar chord. Arpeggios and runs are
measured either the same way or in **repeats**, and you pick which: one repeat
is one pass of whatever the direction produced, so the block comes out as long
as the arpeggio and no longer, while a bar length cycles the pass and cuts it
at the bar line. A melody is however long its own notes make it.

A melody can also **sustain**: one note, held for the rate, which is the
smallest melodic thing there is. It has nothing to point in a direction and no
shape to take, so the panel puts the scale degree where the shape was - the
same degree you chose in step 2, offered again where it is the only thing left
to decide.

A chord can be **chopped** into segments and struck again in each one, from
1/64 up to 1/1. The drums have no named patterns: a kick every 1/4 is four on
the floor, a kick every 1/2 is one and three, a snare every 1/2 is the
backbeat, and each piece has a **shuffle** that pushes every second hit later.

Every block can be **straight, triplet or dotted**, and starts straight. It is
one setting shown on every panel, and it applies to whatever that panel reads
as a rate: the chord's chop, the spacing of a drum, the step an arpeggio walks
in. A block that is not straight says so in its name.

Everything leaves at velocity 100. Shaping a block's dynamics is a job for the
MIDI editor once it is in the project, not for a slider on every panel here.

## Reading the page

The staff is the app now, so it is worth saying what it is doing.

**The key signature is chosen, not looked up.** A table of signatures answers
for the major and minor keys and has nothing to say about the other fourteen
scales here. Harmonic minor cannot be written as a signature at all - its
raised seventh is an accidental in every edition ever printed - and the
diminished scales spell two of their notes on the same letter, which no
signature can hold. So every candidate from seven flats to seven sharps is
scored against what the scale actually spells and the best one wins, with ties
going to the smaller signature. That gives the textbook answer everywhere a
table would have, and the sanest available answer everywhere it would not: the
signature that leaves the fewest accidentals on the page.

**Which staff you get depends on the block.** A block that stays above middle C
is written on a treble staff, one that stays below it on a bass staff, and one
that straddles it on both, braced together. The choice is made once for the
whole block, so a run never hops staves in the middle of itself. The kit is
written on a percussion staff under the neutral clef, with the cymbals on
crossed noteheads.

**What you read is not literally what you hear, in two places, both on
purpose.** Every block leaves the engine gated - a chord set to fill a bar
sounds about nine tenths of it and stops, so the player hears the change - and
writing that down literally would put a tied 63/64ths and a rest where a whole
note belongs, so a note is written as its share of the bar. And a **shuffle**
puts every second hit somewhere no note value can name; printed music writes a
shuffle straight and names it at the top, which is what the block's own name
already does, so the onsets are written on the beat and `shuffle 40` in the
title carries the swing. The MIDI that leaves for REAPER is gated and shuffled
exactly as it always was.

**An incomplete last bar is left incomplete.** A block can be two and a half
bars long, and it is more honest to show the bar stopping where the block does
than to fill it with rests that are not part of it.

## Getting a block out

Unchanged from Starting Blocks. The notation is a way of reading a block, not a
different kind of output.

- **Insert at cursor** puts it on the selected track at the edit cursor, as one
  MIDI item named after the block.
- **Export .mid** writes it into `<REAPER resource path>/Starting Blocks/`.
  Point the Media Explorer at that folder and every block you export is one
  drag away from the arrange.
- **Audition** plays it through the virtual keyboard, so a record-armed and
  monitored track sounds it. The note it is inside lights up on the staff as it
  goes. A deferred script wakes about thirty times a second, so this is a
  preview rather than a performance - a note lands on the nearest wake-up, not
  on the sample. Anything that needs to be exact wants the block in the project,
  where REAPER plays it properly.

## Checking it

```
tools/test.sh
```

| | |
| --- | --- |
| `tests/test_engine.lua` | The generators, by running them. Every direction, repeats, the spelling, the whole catalogue. |
| `tests/test_notate.lua` | The engraver, by running it: signatures, note values, beams, stems, ties, accidentals. |
| `tests/test_draw.lua` | The engraving, by drawing it through a pen that records instead of drawing. |
| `tests/test_midi.lua` | The MIDI writer, read back by a parser that is not itself. |
| `tests/test_place.lua` | Inserting, exporting and auditioning, against a mocked REAPER. |
| `tests/test_ui.lua` | Runs the real script headlessly against a mocked ReaImGui, clicking every control in every panel. |

The engraver is pure and so is the drawing - `sb_draw.lua` draws through a pen
of four calls rather than through ImGui - so almost every question about the
page is a value a test can read rather than something somebody has to look at.
Which way a stem turns, where a beam breaks, whether an accidental is written
or held over from earlier in the bar, whether a dot landed on a space: all
assertions, none of them screenshots.

Every suite here has been checked by deliberately breaking the thing it covers
and watching it fail. Two real gaps were found that way and would not have been
found otherwise: an accidental check that passed happily on a version marking
*every* note, because a run rarely repeats a degree inside one bar; and a
notehead check that covered the whole note's hole and not the half note's,
which are drawn by different branches.

## Seeing the page without REAPER

```
lua5.4 tools/preview_page.lua > page.svg
```

`sb_draw.lua` draws through a pen, so standing a different pen in its place is
the whole trick: this one writes SVG, the window's writes into a ReaImGui draw
list, and both are drawing the same page from the same layout. What comes out
is the engraving itself rather than a picture of what someone remembers it
looking like. Pass block names on the command line to draw only those.

```
lua5.4 tools/preview.lua > preview.json
```

is the original's widget recorder, still here and still recording every control
the window asks for, panel by panel, plus the colours it drew the page in.

## Notes on the catalogue

`docs/BLOCKS.md` has the whole thing, and is generated from the engine's own
tables by `tools/blocks_md.lua`. Two things worth saying here:

The 78 chords follow
[Wikipedia's list of chords](https://en.wikipedia.org/wiki/List_of_chords),
checked against that page's pitch-class column. Two of its entries are not
here: the **Magic chord**'s cell runs two voicings together with no separator,
and the **Northern lights chord** is eleven notes over three octaves. Two named
chords are voiced rather than reduced - the list gives the **Tristan chord** as
the pitch-class set `0 3 6 10`, which makes it a half-diminished seventh and
indistinguishable from one; here it is `0 6 10 15`, F-B-D#-G# as it stands in
the prelude.

Most of what looks missing from that page is not a chord shape at all. Tonic,
Supertonic, Mediant, Subdominant, Dominant, Submediant, Subtonic, the parallels
and counter-parallels, Secondary dominant, Leading-tone triad - all of those
are one of three or four triads under a name that says **which degree of the
key it is built on**. That is the other axis of this script, not a row in its
chord table.

## Where the conventions come from

Where there was a choice to make about how to write something down, the answer
is Karl W. Gehrkens, *Music Notation and Terminology* (1914), which is in the
public domain and cited by section in the source: stems (Sec. 2), beamed groups
(Sec. 4), rests (Sec. 5), the G and F clefs (Sec. 6-7), the shapes of the sharp,
flat and natural (Sec. 8-9), dots (Sec. 11), accidentals lasting to the bar
(Sec. 24) and across a tie (Sec. 25), altered degrees (Sec. 26), and the whole
rest as a measure rest (Sec. 33).

The glyphs are drawn rather than set in a music font, because a REAPER user has
no reason to have one installed and an app that looks wrong on someone else's
machine is worse than one that draws its own.
