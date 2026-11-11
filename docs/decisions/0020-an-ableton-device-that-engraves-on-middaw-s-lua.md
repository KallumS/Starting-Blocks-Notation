# 0020. An Ableton device that engraves on Middaw's Lua

Taken 2026-11-10. Stands.

## Context

The user is moving from REAPER to Ableton Live and asked for every family REAPER project as Max for Live, each on its own branch. The window is ReaImGui, which Max has no equivalent of; the engine is pure Lua, and Max 9 runs modern JavaScript (`[v8]`, `[v8ui]`).

## Decision

`ableton/` holds a Max for Live MIDI effect that runs `reascripts/sb_engine.lua`, `sb_notate.lua`, `sb_draw.lua` and `sb_glyphs.lua` unchanged on Middaw's Lua 5.4 runtime (JavaScript, held to the real Lua byte for byte), through Noterator's adapter - the same route Middaw, Miderator and Noterator take. Only the window is new: one `[v8ui]` shared by every family generator (`ableton/kit/generator.js`), drawn in Middaw's HousePalette, with the window's rules carried over: no dead controls, title-style buttons, sentence-case messages, the status line at the top, a chosen row marked by the accent and a bar.

Results go into a new Session clip on the device's track, the Arrangement at the insert marker, or the clip open in Detail View, as one undo step; a result with several parts puts each further part on a new MIDI track beside it. The key follows Live 12's scale when it is one of ScaleView's. The chosen block is engraved on the right of the device by Middaw's `engrave` call, which records the pen calls `sb_draw.lua` makes.

## Consequences

- `ableton/kit/` is copied into every family repository with a device; `VENDORED.md` there records where each part came from.
- The bundle is built, not hand-written, and `tools/test.sh` fails when it is stale.
- Nothing here has been opened in Live. The tests run the device in Node on a stand-in for Max and the Live Object Model.

## 11 November 2026: Live's colours

The user asked for the Ableton versions to look like Ableton, and pointed to the Ableton-inspired scheme the family had tried: Starting Blocks' window themed after Live 8 on 18 September 2026 (commit 2765b0a3), neutral greys with a warm amber accent, replaced the same day by the yellow house scheme. The devices now draw in that scheme (`ableton/kit/palette.js`), with two changes so the family's rules hold: the chrome is #3E3E3E rather than #4A4A4A, because on the lighter grey a secondary word cannot reach 7:1 and still look secondary; and the buttons are light grey with dark ink, because light words on its #5E5E5E buttons reach only 5:1. The greys are neutral, as Live's are, not blue-shifted as the house scheme's.

Everything the device draws goes through `UI.C`, which is the palette. The REAPER version keeps the house scheme. `kit/test/palette_suite.js` holds the contrast, and was checked by breaking each rule.
