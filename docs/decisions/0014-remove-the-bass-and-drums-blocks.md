# 0014 - Remove the Bass and Drums blocks; leave the engraver's kit alone

- **Date:** 2026-10-08
- **Status:** Accepted. Makes the kit half of 0006 and 0010 unreachable.

## Context

The Bass and Drums blocks were no longer needed, and were asked to come out of
the list of blocks in this app and in Starting Blocks. The request came with a
caution: there might be code deciding where the bass of a chord sits, and that
was not to be touched - only the two blocks were to go from the list.

The engine is shared byte for byte with Starting Blocks (0001), and it is that
repository's decision 0006 that records the engine half.

## Decision

- **The engine** loses the two blocks and everything only they used, in
  Starting Blocks first and copied here unchanged, with its engine, MIDI and
  placement tests and `tools/blocks_md.lua`'s change.
- **The window** loses the two panels and the five settings only they saved,
  and no longer tells the layout a block is drums.
- **The engraver keeps the kit.** The percussion staff, `M.DRUM_MAP`, crossed
  heads, the one-bar cap on a drum's length and the grid snap are all still
  there. Nothing reaches them from the window, and their tests now build a drum
  part by hand. `M.gridFor` lost its drum branch because the engine function it
  called is gone; it is otherwise unchanged.

## Why the kit stays

The ask was the blocks, from the list, carefully. The engraver's kit code is
not a block and is not in any list; it is a way of writing percussion that
nothing now asks for. Removing it is a reasonable next step, but it is a
separate one, and folding it in would have widened a change that was asked to
stay narrow. Nothing about a chord depends on it: the bass staff and the great
staff (0010) are chosen from the notes' range, whatever block made them, and a
chord two octaves down now tests that in place of a bass line.

## What removing the kit would take

If it is wanted gone: `opts.drums` and the `drums` branches in `M.layout` and
`chooseStaves`, `M.DRUM_MAP`, the `perc` clef in `M.CLEFS` and `M.stems`, the
`capTicks` argument to `events()`, the crossed and open heads in `sb_draw.lua`,
the `percClef` and `noteheadX*` glyphs from the bake, and the hand-built kit
tests. The grid snap would stay - it costs nothing on a block whose onsets are
already on its grid, and it is what 0006 rests on.

## Consequences

- A setting saved on Bass or Drums opens on the chord, and the settings only
  they used are not written back. `test_ui.lua` checks both.
- The page can no longer show a shuffle, so 0006 describes behaviour no block
  can produce; the snap it introduced still runs on every block.
- One kit test had never been able to fail: "a drum hit is not written longer
  than a bar" used hits exactly a bar apart, which is as long as the cap
  allows. Rebuilt by hand, it uses one hit in two bars and fails without the
  cap.
