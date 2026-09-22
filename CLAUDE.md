# Starting Blocks Notation

A ReaScript that hands you the smallest useful pieces of music, shows them to
you as notation, and puts them in the project as MIDI. ReaImGui for the window.

This is an offshoot of [Starting Blocks](https://github.com/KallumS/Starting-Blocks).
**The engine, the MIDI writer and everything that touches REAPER are that app's,
unchanged**, so a fix upstream ports across cleanly - do not tidy them here for
their own sake. What is new is the engraver and the ink, and the window's
preview is a page of music where it used to be a piano roll.

**There is no piano roll in this app and there is not meant to be one.** That
is the whole point of the fork. A request that amounts to "show the notes in a
grid as well" is a request to become the app this one came from.

## Shape of it

| | |
| --- | --- |
| `reascripts/Starting Blocks Notation.lua` | The window and the wiring. ReaImGui lives only here. |
| `reascripts/sb_engine.lua` | The music. **No `reaper.` and no `ImGui.` in this file, ever.** |
| `reascripts/sb_notate.lua` | The engraver: a block in, a page out. Pure, and no drawing in it. |
| `reascripts/sb_draw.lua` | The ink. Draws through a pen, so **no `ImGui.` in this file either.** |
| `reascripts/sb_midi.lua` | The MIDI file writer. Pure. |
| `reascripts/sb_place.lua` | Everything that touches REAPER. |

That split is the whole reason the tests are worth anything. The engine is pure
so it can be run and checked; `sb_place.lua` touches REAPER but not ImGui, so a
mocked `reaper` table is enough to test it. Keep it that way: if a music
question needs `reaper.`, the answer is to pass the value in, not to reach out.

**The engraving is split in two for the same reason, and the seam is the pen.**
`sb_notate.lua` decides *what is on the page and where*, in staff spaces, and
returns it as values - a beam group, a stem direction, an accidental. It draws
nothing. `sb_draw.lua` turns that into marks, but it makes them through a pen
of four calls - `line`, `poly`, `circle`, `text` - which it is handed. The
window hands it one backed by a ReaImGui draw list; `tests/test_draw.lua` hands
it one that writes down every mark; `tools/preview_page.lua` hands it one that
writes SVG. All three are drawing the same page.

Keep that seam. It is what lets an assertion about a ledger line exist at all,
and it is why the "ReaImGui lives in one file" rule survived growing a whole
engraver. If a drawing question needs ImGui, the answer is another pen call,
not an import.

## What this thing is for

It hands you **the smallest useful piece**, and you assemble. That sentence has
settled several design arguments already, and it will settle more:

- **A progression block was built and then removed.** Presets swayed the choice
  before a note was played. Picking each chord yourself is the point.
- **Named drum patterns were built and then removed.** "Four on the floor" is a
  kick every 1/4; "one and three" is a kick every 1/2; the backbeat is a snare
  from beat two every 1/2. Naming them named what the rate already said.
- **Velocity sliders were removed.** One velocity, 100, for everything. Dynamics
  belong to the MIDI editor once the block is in the project.
- **Fixed-order arpeggios were removed.** They ordered the lowest three voices
  and appended the rest ascending, which means nothing past the third voice of a
  seventh or a thirteenth. Absent beats quietly wrong.

When something here looks like it wants a preset, a name or a curve, check it is
not really asking for a smaller piece and a number.

**No dead controls.** A control that does nothing in the current state is worse
than no control: the drums hide the rate and shuffle entirely for a tom rather
than showing them greyed. The same instinct removed the old "clicking a degree
while following turns following off" - there was no mode to get stuck in.

Where a control goes dead there is often a better one to put in its place. A
sustained melody has no direction and no shape, so the Melody panel does not
grey them: it drops both and draws the **scale degree** there instead, which is
the only thing left to choose about one held note. That degree is step 2's
degree, drawn a second time - `degreeButtons(idPrefix)` is called from both, so
there is one setting and two places it can be reached, per **one setting shown
in many places** below.

## Generators

Each one fills `c.notes` and leaves the block's length in `c.len`.
`generate()` hands it `c.len` already set to `barBeats * bars`, which is what
chord, bass and drums fill. The other three replace it: a melody is as long as
its own notes, and an arpeggio or a run is as long as `repeats` passes of
whatever the direction produced.

**Bars and repeats are alternatives on an arpeggio and a run, and only there.**
This file used to say the opposite - that a block is measured one way or the
other and which way is a property of the block. That was wrong for these two:
sometimes you want the pass to come out whole, and sometimes you want it to
line up with a bar, and neither answer is the right one always. `st.lengthMode`
picks, and `layOut` dispatches. Chord, bass and drums are bars only; melody is
its own length and ignores the mode entirely.

Bars are a list with fractions in it, not a number: `M.BAR_LENGTHS` runs from a
quarter of a bar to eight. Anything iterating bars has to cope with `st.bars`
being less than one - the drum generator walks `while bar * barBeats < c.len`
and clips each hit, rather than `for bar = 0, st.bars - 1`, which simply does
not run for a fraction.

**Count, do not accumulate.** `layRepeats` and the chord's chop both compute
`n` and loop `i = 0, n - 1`, so the last note of a pass cannot land a rounding
error short of the end the way `pos = pos + step` could.
`M.passLength(st)` is the same count without generating anything, for the UI.

There used to be a progression block that laid any of these out across a
sequence of degrees, which is why generators once took an offset and a degree
rather than reading `st`. It went, and the offset machinery went with it. In
the history if the idea comes back.

## State

One plain table describes a block completely, and every engine function is a
pure function of it. `M.clampState(st)` puts every field back inside its table
and inside the range of the slider that shows it.

Settings are saved as `key=value` pairs in one ExtState string. A field dropped
from `SAVED` simply stops being written and is ignored on the way back in, so
removing a setting needs nothing else done to old saved state. Values come back
through `tonumber(v) or v`, so a string setting is fine as long as it never
looks like a number - the drum rates are `"1/8"` and friends, which never do.

**One setting shown in many places beats one setting per place.** Straight,
triplet and dotted is a single `rateMod` drawn on every panel, because a block
is in one feel or the other and it is the same question wherever it is asked.
Whatever a panel reads as a rate goes through it: `M.rateBeats`, `M.chopBeats`
and `M.drumStep` all multiply by `M.modMul`. Adding a new rate-like setting
means adding it to that list, and to `M.modSuffix` so two feels of one rate do
not become two blocks with the same name.

**Prefer a name to an index when a list differs between contexts.** `drumRate`
is kept as `"1/8"`, not as position 3, so moving from a kick to a snare keeps
1/8 as 1/8 instead of sliding it up a shorter list. An unknown name falls back
to `1/1`, which is why every piece's rates end there.

**Slider ranges in the script and the clamps in `clampState` have to agree.**
ReaImGui refuses a value outside a slider's declared range, so a setting that
can legally reach 100 shown by a slider declared 0..50 is a runtime error.
`tests/test_ui.lua` now loads state at both ends of every clamp and draws every
panel, which catches exactly that - but it still cannot tell you which of the
two is wrong. Change both together.

## Tables

A chord is one row carrying its own name, symbol and intervals, so it cannot
half-exist. Under the old JSFX these were three parallel tables and adding a
chord meant editing all three in step; do not reintroduce that. The same goes
for the drum pieces, which now carry their own rates and starting beat.

Scales and roots are copied from ScaleView for REAPER and `test_engine.lua`
asserts they still match it. Do not tidy them independently.

Every seven-note scale walks the letters in order, so those alone cannot tell
the `letters` table apart from a plain index. The pentatonic, blues and
diminished scales are what make it load-bearing, and the spelling tests use
them for exactly that reason. **This was found by deliberately breaking the
speller and watching the tests pass.**

Nothing the controls allow can overflow the note buffer - the longest block
available is a diminished-scale run, four octaves, up and down, sixteen times,
which is 1024 on the nose. The guard still has to work, so `test_engine.lua`
shrinks `E.MAX_NOTES` to test it rather than pretending some setting reaches it.

## ReaImGui

- Load it the documented way: `reaper.ImGui_GetBuiltinPath()`, then
  `dofile(path .. '/imgui.lua')('0.9')`. Not the old flat `reaper.ImGui_*` API.
- Every `PushID` needs its `PopID`, every `PushStyleColor(n)` its
  `PopStyleColor(n)`. The UI test counts them per frame.
- Button labels are IDs. Two buttons with the same label in one window are the
  same button unless they are inside different `PushID`s.
- Colours are `0xRRGGBBAA`.
- Every `PushStyleVar` needs its `PopStyleVar` too; the UI test counts those
  per frame alongside the ids and colours.
- ReaImGui patches Dear ImGui so a **top-level** window can carry its own
  background alpha, which plain Dear ImGui cannot. `SetNextWindowBgAlpha(ctx, 1)`
  makes it solid and `Col_WindowBg` sets the colour. Both are read by `Begin`,
  so they are set before it and popped straight after - pushing a window style
  colour inside the window styles the wrong thing.
- **`StyleVar_WindowRounding` did not visibly round the window** when it was
  tried, whatever the patch notes say. The outer radius appears to be the host
  window's to draw. It was removed rather than left in doing nothing.

## REAPER, from a script

- `TimeMap_GetTimeSigAtTime` returns `num, denom, tempo`. **There is no retval
  in front of them.** Reading one there wrote 4/2 into every exported file for
  a while, and the test mock had the same wrong shape so it agreed with the bug.
  Check a signature in the API docs before destructuring it, and write the mock
  from the signature rather than from the code's assumption about it.
- `MIDI_InsertNote`'s last argument is **noSort**. Pass true for each note in a
  batch, then call `MIDI_Sort` once.
- A refusal has to close the undo block it opened.

## Finding your way down the window

The three things done in order - **1 Key, 2 Scale degree, 3 Building block** -
are numbered, with a gap after each. The options and the buttons under them are
not a step: they are what you do once the three are chosen.

There were arrows drawn in those gaps. Taking them out and **leaving the gap**
separated the steps just as well with nothing on screen to read, which is the
better answer. The test counts the gaps rather than the arrows now, so losing
one still fails.

The step numbers are **neutral, not an accent**, and the test holds that in
place: the step colour is pushed as a text colour nowhere but on the numbers.

## Colour

Three colours: a dark grey ground, a light grey for the controls raised off
it, and one yellow for whatever is switched on. **These are settled** - they
were chosen deliberately and signed off, so treat a change to any of the three
values as a change of mind rather than a tidy-up.

**Every grey in `THEME` is blue-shifted**, R < G < B all the way down the ramp.
It is the easiest thing in that table to undo by accident: a neutral grey looks
perfectly correct in a diff and only reads as flat once it is on screen next to
the yellow. The greys in this window were neutral for a long time, which is
exactly why the mistake is an easy one to make twice.

The dark end of the ramp is the ground and the paper, and it stops short of
black on purpose - flat black under a saturated yellow reads as a hole rather
than a surface.

`THEME` is a list of `{ "Col_Name", 0xRRGGBBAA }` pushed before `Begin` and
popped after `End` - **outside the `visible` test**, because a push always
needs its pop and a collapsed window still pushed. Adding a colour is one row.
A `Col_` name that does not exist is a hard error in REAPER, and the mock's
`__index` raises on it, so an invented one fails in the test instead.

**The buttons are lighter than the chrome, which is new.** Every earlier scheme
here raised the buttons a shade off a mid-grey and lettered them in the
window's own light text; this one puts a light grey on a dark ground, so the
light text would vanish. `pick()` therefore pushes `INK` for **every**
button, chosen or not - the first scheme here where an unchosen button needs a
text colour of its own. Drop that push and the grey buttons go unreadable while
the chosen one still looks fine, which is exactly the failure a frame-wide
"was dark ink pushed?" check cannot see. The mock keeps a real style-colour
stack and records the fill and the text **per button**, and the test walks
every button drawn.

**The notes are no longer in the accent, and this is the one place the scheme
parts company with the app it came from.** There, a note was a yellow bar in a
roll; the accent was shared with a chosen button and what kept the two apart
was ground rather than hue. That does not survive becoming notation. A note
here is a glyph with a stem, a hook and sometimes an accidental in front of it,
and a page of yellow ones is not something anyone can read as music.

So the page is set in ink - a near-white on the dark paper - and the accent is
spent on the single thing that is switched on: **the note the playhead is
inside while an audition runs**. Yellow still means "this one, now". There is
one of it on the page instead of forty.

The test was rewritten to match rather than deleted, and it holds the two
properties that make the page legible at all: the music is far lighter than the
paper, and the paper is darker than the chrome the buttons sit on. It also
asserts that **nothing is drawn in the accent while nothing is playing**, which
is the assertion that would catch someone restoring the old rule by habit.

`shade()` makes the hover and held states from the accent rather than
hand-picking them. Arithmetic rather than bit operators, like the MIDI writer,
and it must keep the alpha byte or ReaImGui is handed a fully transparent
colour. **It has now been deleted twice by a careless block replacement** -
it lives among the colour constants but is not one, so check it survived.

## The engraving

The music is not the page. Two things are written down differently from how
they sound, both deliberately, and both would look like bugs to someone who
found them by reading the code rather than the music:

- **A note is written as its share of the bar, not as its gated length.** Every
  block leaves the engine gated, so a chord filling a bar sounds nine tenths of
  it and stops. Notating that literally puts a tied 63/64ths and a rest where a
  whole note belongs. `events()` therefore takes each note's duration as the
  distance to whatever starts next. The MIDI is still exported gated - this is
  the notation's business only.
- **A shuffle is written straight.** It pushes every second hit a third of the
  way to the next, which no note value can name. Printed music writes a shuffle
  straight and names it at the top, which the block's own name already does
  ("Kick 1/16 shuffle 40"), so onsets are snapped back to the block's own grid.
  `M.gridFor` is what says which grid that is. Before this existed, a shuffled
  bar came out as sixteen quarter notes, because every duration fell through
  `split` and hit the fallback.

**`M.split` writes a duration with one symbol wherever it falls.** It used to
split at the metric grid first, and that was wrong about printed music: a half
note on the second beat of a three-four bar is a half note, and a rule deriving
"the beat divides the bar" split it into two tied quarters. Only a duration
with no symbol of its own is decomposed now. Everything the panels can ask for
is a rate times a count, so the single-symbol path is what nearly always runs.

**The key signature is scored, not looked up.** `chooseSignature` tries all
fifteen and picks the one agreeing most with what the scale actually spells.
This is not cleverness for its own sake: a table answers for major and minor
and has nothing to say about the other fourteen scales, and two of them cannot
be expressed as a signature at all. Harmonic minor has to come out as the plain
minor's signature with the seventh as an accidental, and `test_notate.lua`
asserts exactly that - it is the case that proves the scoring is doing a job a
table could not.

**Stem length is measured from the far head of a chord**, the lowest under an
upward stem. Measuring from the near one makes a triad's stem half as long
again as it should be, which a bar of chopped chords shows at a glance and a
single melody note never does.

**A beam leans by a quarter of the interval it covers and at most a space and
a bit.** A rising scale in sixteenths is the shape that settles this: at
anything near the full interval the beams stand on end.

**Positions are half-spaces above the bottom line**, so a line is even and a
space is odd. That one convention is why the dot rule (Sec. 11 - always on a
space) is `(pos % 2 == 0) and pos + 1 or pos` rather than anything harder, and
why ledger lines step by two.

**Where a convention was a choice, the source cites Gehrkens by section.** Keep
that up: a citation is the difference between a rule someone can check and a
number someone tuned until it looked right.

## Tests

```
tools/test.sh
```

| | |
| --- | --- |
| `test_engine.lua` | The generators, by running them. |
| `test_notate.lua` | The engraver, by running it. Signatures, values, beams, stems, ties, accidentals. |
| `test_draw.lua` | The engraving, by drawing it through a pen that records instead of drawing. |
| `test_midi.lua` | The MIDI writer, read back by a parser that is not itself. |
| `test_place.lua` | Inserting, exporting and auditioning, against a mocked REAPER. |
| `test_ui.lua` | The real script against a mocked ReaImGui. |

`tests/test_ui.lua` runs the real script against a mocked ReaImGui whose
`__index` raises on anything it does not have, so calling a ReaImGui function
that does not exist fails here rather than in REAPER. It clicks every button in
every panel, drives every slider to both ends **from every button state** - a
panel can hide a control behind another one, and the drums do - reloads the
script on top of its own saved settings, and loads state at both ends of every
clamp.

When you add a control, nothing needs to be added to the test: the sweep finds
it. When you add a ReaImGui function, add it to the mock.

**The sweep cannot see one control swapped for another.** It clicks what is on
screen, so a panel that shows A where it used to show B still draws, still
balances its pushes and still has the same sliders - the sweep is happy either
way. Melody's sustain swap was written, and deliberately broken, and every
suite still passed. Assert a swap directly: count the labels on screen in each
state, and click the second copy of a shared control to prove it drives the same
setting rather than a new one. The sweep leaves the key wherever it stopped, so
such a test clears the ExtState and reloads the script first, or the numerals it
is counting are not the ones it expects.

**Prove a test bites before believing it.** Every suite here has been checked by
deliberately breaking the thing it covers and watching it fail. Six real gaps
were found that way and would not have been found otherwise: the speller test
that only covered seven-note scales, the slider sweep that never reached a
conditionally-shown control, settings loading that clamped some fields and not
others, the sweep's blindness to a swapped control described above, and the two
the engraver added -

- the accidental check asserted only that an accidental is not written **twice**
  on one degree in a bar, and passed happily on a version that marked **every
  single note**, because a run rarely repeats a degree inside one bar. What
  bites is the opposite assertion: a scale written in its own key wears no
  accidentals at all, because the signature has already said them.
- the open-notehead check covered the whole note's hole and not the half
  note's. They are drawn by different branches, so deleting one of them failed
  nothing. Both are checked now.

A test that has never failed has not been tested.

**Two invariants do most of the work in the engraver's suite, and both are
sweeps rather than examples.** Every measure of every block the panels can ask
for is asserted to be filled *exactly* - nothing lost, nothing invented - which
catches a split, a tie or a rest going wrong anywhere in the pipeline. And
nothing is drawn outside the room `D.height` promised the window, checked
against the blocks that reach furthest from the staff rather than a comfortable
one. `D.page` returns `D.height`'s own answer rather than recomputing it,
because two expressions for one number is two expressions to keep in step and
the one that drifts is the one nobody is looking at.

**Name what you assert, do not count it.** The slider check lists the sliders it
reached rather than counting them, so a control that stops being reachable shows
up as a missing name instead of a number that quietly went down by one.

`docs/BLOCKS.md` is generated by `tools/blocks_md.lua`, which reads the engine's
tables directly. Do not hand-edit it; `tools/test.sh` fails if it is stale.

## Previewing the window without REAPER

```
python3 tools/run_lua.py tools/preview.lua > preview.json
```

`tools/preview.lua` stands a recording mock in ReaImGui's place, loads the real
script unchanged, and writes down every widget it asks for, in order, for every
panel - plus the notes the engine really generates for each. A preview built
from that is a recording rather than a drawing of what someone remembers, so it
cannot flatter the layout.

What it is faithful about: the widgets, their order, their labels, which are
chosen, the note data, and **the colours** - `doc.theme` is every `Col_` the
script pushed and `doc.page` is what the page was drawn in. What it is not:
spacing and font metrics, because ReaImGui measures text with its own font -
and it says nothing at all about the *shape* of the page, which is the next
tool's job.

The colours were added because a preview that records the widgets and then
paints them from a palette typed out by hand is only half a recording, and the
painted half is the half that flatters. Two details make it keep working: the
mock mints each `Col_` name on first use through a metatable, so a colour added
to `THEME` turns up with nothing edited here; and the page's colours are told
apart by **the drawing order inside `notation`** - the paper first, then the
staff lines on it - rather than by their position in a list, so they survive a
recolouring.

## Seeing the engraving without REAPER

```
lua5.4 tools/preview_page.lua > page.svg
```

This is the one that draws the music. `sb_draw.lua` draws through a pen, so
standing an SVG pen in ImGui's place gets the real page out of it - same
layout, same glyph code, same geometry, different four functions at the end.
It is not a mock-up and it cannot flatter the engraving, because there is no
second implementation for it to flatter with.

**Use it.** Nearly every real fault in the engraving was found by rendering
this and looking at it, not by reading the code: the clef that was two spaces
too tall, the stems drawn once as a guess and again under the beam, the beams
that stood on end over a rising scale, the triad whose stem was measured from
the wrong head. None of those failed a test that existed at the time, and all
of them were obvious the moment they were on screen. Write the test afterwards
for the ones that can be asserted - most can - but look first.

Pass block names on the command line to draw only those, which is what makes
iterating on one glyph bearable.

## History worth knowing

**This app is Starting Blocks with the roll replaced.** The engine, the MIDI
writer and `sb_place.lua` came across unchanged and should stay that way, so a
fix upstream is a copy rather than a merge. Everything new is `sb_notate.lua`,
`sb_draw.lua`, their two suites and `tools/preview_page.lua`.


Version 1 was a JSFX plus a bridge ReaScript talking over `gmem`. JSFX cannot
write a file, cannot reach the REAPER API and cannot start a drag - none of
those are in its API - so the plugin built blocks and the bridge placed them.
It worked, and none of it is needed from a script.

The engine was EEL2 then, which only runs inside REAPER, so what a converging
arpeggio actually came out as could only be checked by reading it. That is the
single biggest reason the port was worth doing, and the reason the engine must
stay free of `reaper.`

A "place with the mouse" mode was built - it asked which track the pointer was
over and what time it pointed at - and removed, because Insert at cursor does
the job.
