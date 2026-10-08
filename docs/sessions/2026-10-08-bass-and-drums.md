# 2026-10-08 - The Bass and Drums blocks removed

**Asked for:** remove the Drums and Bass blocks from this app and from
Starting Blocks. Then, while it was under way, two cautions: there might be
code dictating where the bass sits in a chord - only the two blocks were to go
from the list - and every doc in both repositories was to be read first.

Done in both. Decision: [0014](../decisions/0014-remove-the-bass-and-drums-blocks.md),
and Starting Blocks' own 0006 for the engine.

## The route

**Edits had started before the docs were read, and stopped when they were
asked for.** By then the engine had already lost the two blocks in Starting
Blocks, and its window the two panels. Reading everything - both CLAUDE.md
files, both READMEs, all eighteen decision records, the session logs, the
colour guide and the two conversation backups - changed nothing already done,
and it fixed the shape of what was left:

- **0001 says the engine is copied unchanged**, so it was changed once, in
  Starting Blocks, and copied here. The engine, MIDI and placement tests had
  been byte-identical between the two before, so they were copied too, and
  `tools/blocks_md.lua` took the same change with its one-line title kept.
- **0010 says the staff is chosen from the block's range**, which is why the
  bass staff and great staff could not be touched: they belong to any low
  chord, not to the Bass block.
- **Noterator's 0024 had already hidden both blocks** in its adapter, and it
  never edits its engine copies, so it needed nothing.

**Where the bass of a chord sits** is the chord's inversion, `st.inv`, through
`M.chordTones`. The Bass block called `M.chordTones(st, st.degree, 0)` and took
one tone; nothing flowed back. The inversion tests were not touched and pass,
and every chord on the preview sheet renders as before - including the
thirteenth on the great staff and a chord two octaves down alone on the bass
staff.

**The engraver's kit was left in.** It is not a block and not in a list, and
the ask was to keep the change narrow; 0014 lists what removing it would take.
Its tests could no longer ask the engine for a drum block, so they build the
part by hand. Doing that exposed a test that had never been able to fail: "no
drum hit is written longer than a bar" used a crash every bar, exactly as long
as the cap allows, so removing the cap changed nothing. One crash in two bars
fails without it.

**The winding test from the Bravura session leaned on the kit.** Its "every
polygon is clockwise" check is only failed, when the correction is removed, by
the kit's beams. The kit page is now built by hand in `test_draw.lua` so that
check still bites.

**Tests that used a removed block for something else were moved:** the bass
staff test to a low chord, the "furthest below the staff" bounds case to a run
two octaves down, the settings round-trip to Melody, the hidden-slider sweep's
example to Melody's held note. New: a setting saved on Bass or Drums opens on
the chord and does not write their settings back; the kinds of block are
asserted by name. Each was broken on purpose and failed.

## Not done

- The engraver's kit code is unreachable and could go; that is for the owner
  to decide (0014).
- Noterator's vendored engine is a sync behind; nothing it shows changes.
