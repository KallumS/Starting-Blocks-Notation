# 0001 - Fork Starting Blocks rather than add a notation mode to it

- **Date:** 2026-09-22
- **Status:** Accepted

## Context

Starting Blocks already does everything this app does except draw. The obvious
cheaper move is a toggle in that app: a button that swaps the roll for a staff,
one codebase, one install, one set of tests.

The brief was an offshoot with the same functionality that displays notation
instead of MIDI, with MIDI still exported to REAPER.

## Decision

A separate repository, separate script name, separate ExtState section, and
separate files under `Scripts/`. The two install side by side and neither knows
about the other.

The engine, the MIDI writer and `sb_place.lua` are copied across **unchanged**
and are to stay that way, so an upstream fix arrives as a copy rather than a
merge.

## Why

A toggle would have made every design question conditional. The preview pane is
92 pixels tall in the parent app because a roll of any height says the same
thing; a page of notation needs room to wrap onto a second system and room
above the staff for a beam. The accent is spent on every note there (0008) and
cannot be here. Half the decisions in this list are answers that only make
sense if notation is the only thing on screen, and every one of them would have
become an `if mode == "notation"` branch in a file that had no branches before.

Keeping the shared four files byte-identical is what makes the fork cheap to
maintain. It is a real constraint, not an aspiration: tidying `sb_engine.lua`
here for its own sake turns every future upstream fix into a merge conflict.

## Consequences

- A bug fixed in the shared files upstream has to be copied here by hand. That
  is the price, and it is smaller than the branching would have been.
- Two apps to install, and a user who wants both gets both. The separate
  ExtState section means their settings do not collide.
- `docs/BLOCKS.md` is duplicated. It is generated, so it costs nothing to
  regenerate and cannot drift silently - `tools/test.sh` fails if it is stale.
