--[[
 * ReaScript Name: Starting Blocks Notation
 * Description:    A catalogue of the smallest useful pieces of music - chords,
 *                 arpeggios, runs, melodic steps and leaps, bass notes, single
 *                 drum hits - picked by key, scale and scale degree, read as
 *                 notation, and put into the project as MIDI.
 *
 * About:          Pick a key. Pick a degree of it. Pick a block. Read it on the
 *                 staff. Then insert it at the edit cursor, write it out as a
 *                 .mid, or audition it.
 *
 *                 The window shows notation and nothing else - there is no
 *                 piano roll in it. What leaves for REAPER is still MIDI.
 *
 *                 Needs ReaImGui, from the ReaTeam Extensions repository.
 * Author:         Kallum Shah
 * Links:          https://github.com/KallumS/Starting-Blocks-Notation
 * Version:        1.0
 * Provides:
 *   sb_engine.lua
 *   sb_midi.lua
 *   sb_place.lua
 *   sb_notate.lua
 *   sb_draw.lua
--]]

local TITLE   = "Starting Blocks Notation"
local SECTION = "StartingBlocksNotation"

------------------------------------------------------------------------------
-- Dependencies
------------------------------------------------------------------------------

local imgui_path = reaper.ImGui_GetBuiltinPath and
                   (reaper.ImGui_GetBuiltinPath() .. "/imgui.lua")
if not imgui_path then
  reaper.MB("Starting Blocks needs the ReaImGui extension.\n\n" ..
            "Install it with ReaPack, from the ReaTeam Extensions repository.",
            "Missing dependency", 0)
  return
end
local ImGui = dofile(imgui_path)("0.9")

local HERE = ({ reaper.get_action_context() })[2]:match("^(.*[/\\])")
local E      = dofile(HERE .. "sb_engine.lua")
local Midi   = dofile(HERE .. "sb_midi.lua")
local Place  = dofile(HERE .. "sb_place.lua")
local Notate = dofile(HERE .. "sb_notate.lua")
local Draw   = dofile(HERE .. "sb_draw.lua")
Place.setMidi(Midi)
Draw.setNotate(Notate)

------------------------------------------------------------------------------
-- Look
------------------------------------------------------------------------------

-- Three colours: a dark grey ground, a light grey for the controls raised off
-- it, and one yellow for whatever is switched on.
--
-- **Every grey here is blue-shifted** - R < G < B, all the way down the ramp.
-- That is deliberate and it is the easiest thing in this table to undo by
-- accident, because a neutral grey looks correct in a diff and only reads as
-- flat next to the yellow. The greys in this window were neutral for a long
-- time; they are not any more.
--
-- The dark end of the ramp is the ground and the roll, and it stops short of
-- black: flat black under a saturated yellow reads as a hole rather than a
-- surface.
local THEME = {
  { "Col_Text",              0xDDE1E7FF },
  { "Col_TextDisabled",      0x8A919CFF },
  { "Col_WindowBg",          0x23272EFF },   -- the chrome: dark grey, cool
  { "Col_PopupBg",           0x1B1F25FF },
  { "Col_Border",            0x14171CFF },
  { "Col_FrameBg",           0x1A1D23FF },   -- anything sunk into the chrome
  { "Col_FrameBgHovered",    0x22262DFF },
  { "Col_FrameBgActive",     0x2A2F37FF },
  { "Col_TitleBg",           0x1B1F25FF },
  { "Col_TitleBgActive",     0x23272EFF },
  { "Col_TitleBgCollapsed",  0x1B1F25FF },
  { "Col_Button",            0xA9AFBAFF },   -- the controls: light grey, raised
  { "Col_ButtonHovered",     0xC0C6CFFF },
  { "Col_ButtonActive",      0x8F96A2FF },
  { "Col_CheckMark",         0xFFF200FF },
  { "Col_SliderGrab",        0xA9AFBAFF },
  { "Col_SliderGrabActive",  0xFFF200FF },
  { "Col_Separator",         0x3A404AFF },
  { "Col_ScrollbarBg",       0x1A1D23FF },
  { "Col_ScrollbarGrab",     0x585F6BFF },
  { "Col_ScrollbarGrabHovered", 0x6D7581FF },
  { "Col_ScrollbarGrabActive",  0xA9AFBAFF },
}

-- The accent, spent on what is switched on - and, unlike every scheme this
-- window has worn before it, on the notes too.
local SELECTED    = 0xFFF200FF

-- Ink. The buttons are lighter than the chrome now, so the text on one has to
-- go dark - on the grey and on the yellow alike. This is the only scheme here
-- where an unchosen button needs a text colour of its own.
local INK         = 0x14171CFF

-- The step numbers. Neutral: they show the order and nothing more.
local STEP        = 0xBFC5CEFF

-- The page is drawn rather than composed of widgets. The dark end of the same
-- cool ramp is the paper; the music is set on it in a near-white ink.
--
-- **The notes are not in the accent here, and that is the one place this
-- scheme parts company with the app it came from.** There, a note was a yellow
-- bar in a roll and sharing the accent with a chosen button cost nothing. Here
-- a note is a glyph with a stem, a hook and sometimes an accidental in front
-- of it, and a page of yellow ones is not music anyone can read. So the ink is
-- ink, and the accent is spent on the single thing that is switched on: the
-- note the playhead is inside while an audition runs. Yellow still means "this
-- one, now" - there is simply one of it on the page rather than forty.
local PAPER       = 0x111419FF
local MUSIC       = 0xE8EBEFFF
local STAFF_LINE  = 0x6E7683FF
local PLAYING     = SELECTED
local DIM         = 0x8A919CFF
local WARN        = 0xD2483FFF

-- How big a staff space is, in pixels. Everything on the page is a fraction of
-- this one number.
local SPACE       = 10

-- Shifts a colour towards white or black, so the chosen state needs one colour
-- rather than three. Arithmetic rather than bit operators, like the MIDI
-- writer, so it does not care which Lua a REAPER build carries - and it keeps
-- the alpha byte, or ReaImGui is handed a fully transparent colour.
local function shade(col, amount)
  local a = col % 256
  local b = math.floor(col / 256) % 256
  local g = math.floor(col / 65536) % 256
  local r = math.floor(col / 16777216) % 256
  local function mix(c)
    if amount >= 0 then return math.floor(c + (255 - c) * amount + 0.5) end
    return math.floor(c * (1 + amount) + 0.5)
  end
  return mix(r) * 16777216 + mix(g) * 65536 + mix(b) * 256 + a
end

-- ReaImGui patches Dear ImGui so a top-level window can carry its own
-- background alpha, which a plain Dear ImGui window cannot. The same patch
-- covers corner rounding, but rounding the window did not show on screen, so
-- it is not here: an outer radius is the host window's to draw, not ours.

------------------------------------------------------------------------------
-- State
------------------------------------------------------------------------------

local st = E.newState()
local ui = {
  loop   = false,
  status = "",
  warn   = false,
  block  = nil,      -- the last generated block
  key    = nil,      -- how to spell it, and in what signature
  doc    = nil,      -- the last engraved page
  tsNum  = 4,
  tsDen  = 4,
  dirty  = true,
}

local ctx

local function rebuild()
  st.barBeats = Place.barBeats()
  ui.tsNum, ui.tsDen = Place.timeSig(Place.cursor())
  ui.block = E.generate(st)
  -- The key the page is engraved in, and the page itself. Both are a pure
  -- function of the state, so both are worked out here and nowhere else.
  ui.key = Notate.context(E, st)
  ui.doc = nil
  ui.dirty = false
end

local function touched() ui.dirty = true end

local function say(text, warn)
  ui.status, ui.warn = text, warn or false
end

------------------------------------------------------------------------------
-- Settings that outlive the window
------------------------------------------------------------------------------

local SAVED = { "root", "scale", "degree", "cat", "family", "dia", "chord",
                "inv", "oct", "pattern", "runDir", "rate", "rateMod",
                "octaves", "repeats", "bars", "gate", "chop", "shuffle",
                "interval", "melDir", "shape", "bassTone", "bassOct",
                "drumPiece", "drumRate", "baseOct" }

local function saveState()
  local out = {}
  for _, k in ipairs(SAVED) do out[#out + 1] = k .. "=" .. tostring(st[k]) end
  reaper.SetExtState(SECTION, "state", table.concat(out, ";"), true)
end

local function loadState()
  local blob = reaper.GetExtState(SECTION, "state")
  if not blob or blob == "" then return end
  local got = {}
  for pair in blob:gmatch("[^;]+") do
    local k, v = pair:match("^(%w+)=(.*)$")
    if k then got[k] = v end
  end
  for _, k in ipairs(SAVED) do
    if got[k] then st[k] = tonumber(got[k]) or got[k] end
  end
  -- A saved setting may name something that no longer exists, or a degree the
  -- scale does not have, or a value past the end of the slider that shows it.
  -- The engine owns the tables, so it owns putting all of that back in range.
  E.clampState(st)
end


------------------------------------------------------------------------------
-- Widgets
------------------------------------------------------------------------------

-- The whole theme goes on before Begin and comes off after End, so it covers
-- the window itself as well as everything in it.
local function pushTheme()
  for _, c in ipairs(THEME) do ImGui.PushStyleColor(ctx, ImGui[c[1]], c[2]) end
end
local function popTheme() ImGui.PopStyleColor(ctx, #THEME) end

-- An unchosen button wears the theme's grey. A chosen one takes the accent.
-- Either way the text on it goes to INK: both are far lighter than the chrome,
-- so the window's own light text would vanish on them.
local function pick(label, selected, width)
  local pushed = 1
  if selected then
    ImGui.PushStyleColor(ctx, ImGui.Col_Button, SELECTED)
    ImGui.PushStyleColor(ctx, ImGui.Col_ButtonHovered, shade(SELECTED, 0.18))
    ImGui.PushStyleColor(ctx, ImGui.Col_ButtonActive, shade(SELECTED, -0.18))
    pushed = 4
  end
  ImGui.PushStyleColor(ctx, ImGui.Col_Text, INK)
  local hit = ImGui.Button(ctx, label, width or 0, 0)
  ImGui.PopStyleColor(ctx, pushed)
  return hit
end

-- `n` numbers the step, for the three that are done in order.
local function heading(n, text)
  if n then
    ImGui.PushStyleColor(ctx, ImGui.Col_Text, STEP)
    ImGui.Text(ctx, tostring(n))
    ImGui.PopStyleColor(ctx, 1)
    ImGui.SameLine(ctx, 0, 10)
  end
  ImGui.SeparatorText(ctx, text)
end

-- The space between one numbered step and the next. There were arrows drawn in
-- here; taking them out and leaving the gap turned out to separate the steps
-- just as well, with nothing on screen to read.
local STEP_GAP = 22
local function stepGap() ImGui.Dummy(ctx, 16, STEP_GAP) end

local function tip(text)
  if text and ImGui.IsItemHovered(ctx) then ImGui.SetTooltip(ctx, text) end
end

-- A wrapped row of choices. `get` reads the current one, `label`/`hint` name
-- each entry. Returns the index clicked, or nil.
local function chooser(id, items, current, perRow, width, label, hint)
  local chosen
  ImGui.PushID(ctx, id)
  for i, item in ipairs(items) do
    if i > 1 and (perRow == 0 or (i - 1) % perRow ~= 0) then ImGui.SameLine(ctx) end
    ImGui.PushID(ctx, i)
    if pick(label and label(item, i) or tostring(item), current == i, width) then
      chosen = i
    end
    if hint then tip(hint(item, i)) end
    ImGui.PopID(ctx)
  end
  ImGui.PopID(ctx)
  return chosen
end

local function slider(id, label, value, lo, hi, width)
  ImGui.PushItemWidth(ctx, width or 130)
  local changed, v = ImGui.SliderInt(ctx, label .. "##" .. id, value, lo, hi)
  ImGui.PopItemWidth(ctx)
  return changed, v
end

local function dim(text)
  ImGui.PushStyleColor(ctx, ImGui.Col_Text, DIM)
  ImGui.Text(ctx, text)
  ImGui.PopStyleColor(ctx, 1)
end

------------------------------------------------------------------------------
-- The page
------------------------------------------------------------------------------

-- `sb_draw.lua` draws through a pen rather than through ImGui, so this is the
-- only place in the notation that knows ReaImGui exists. The same four calls
-- backed by an SVG writer are what `tools/preview_page.lua` renders with, so
-- what that tool prints is this page and not a picture of it.
local penFont

-- Whether this ReaImGui can size text on demand. Asked once, through a pcall,
-- because the answer is a missing key and the shim is entitled to raise on one
-- rather than return nil - the same reason the README tells anyone on an older
-- ReaImGui which line to edit.
local hasTextEx
local function sizedText()
  if hasTextEx == nil then
    local got, fn = pcall(function() return ImGui.DrawList_AddTextEx end)
    hasTextEx = got and type(fn) == "function"
  end
  return hasTextEx
end

local function penFor(dl)
  return {
    line = function(x1, y1, x2, y2, col, th)
      ImGui.DrawList_AddLine(dl, x1, y1, x2, y2, col, th or 1)
    end,
    poly = function(pts, col)
      ImGui.DrawList_AddConvexPolyFilled(dl, reaper.new_array(pts), col)
    end,
    circle = function(x, y, r, col, filled)
      if filled then
        ImGui.DrawList_AddCircleFilled(dl, x, y, r, col)
      else
        ImGui.DrawList_AddCircle(dl, x, y, r, col, 0, math.max(1, r * 0.4))
      end
    end,
    text = function(x, y, col, str, size, center)
      str = tostring(str)
      -- A figure on a staff wants to be sized against the staff, not against
      -- the window's font. AddTextEx takes a size; where a build has no such
      -- call the plain one still puts the right character in the right place,
      -- so the page degrades to the wrong size rather than to nothing.
      if penFont and sizedText() then
        local w, h = ImGui.CalcTextSize(ctx, str)
        local scale = size / math.max(h, 1)
        ImGui.DrawList_AddTextEx(dl, penFont, size,
          x - (center and w * scale / 2 or 0), y - size / 2, col, str)
      else
        local w, h = ImGui.CalcTextSize(ctx, str)
        ImGui.DrawList_AddText(dl, x - (center and w / 2 or 0), y - h / 2, col, str)
      end
    end,
  }
end

-- The page, laid out for the width it has been given and drawn at `SPACE`.
-- The document is kept between frames: it is the same answer until the block
-- or the width changes, and rebuilding it sixty times a second to draw the
-- same thing would be work for nothing.
local function notation(block, width)
  local dl   = ImGui.GetWindowDrawList(ctx)
  local x, y = ImGui.GetCursorScreenPos(ctx)

  if block and (not ui.doc or ui.docWidth ~= width) then
    ui.doc = Notate.layout(block, {
      barBeats = st.barBeats,
      tsNum    = ui.tsNum,
      tsDen    = ui.tsDen,
      ctx      = ui.key,
      drums    = st.cat == "Drums",
      grid     = Notate.gridFor(E, st),
      width    = width / SPACE,
    })
    ui.docWidth = width
  end

  local doc    = block and ui.doc or nil
  local height = doc and Draw.height(doc, SPACE) or (6 * SPACE)
  ImGui.InvisibleButton(ctx, "##page", width, height)
  ImGui.DrawList_AddRectFilled(dl, x, y, x + width, y + height, PAPER, 3)
  if not doc then return end

  -- While an audition runs, the note it is inside takes the accent. There is
  -- one of these on the page at a time, which is the whole reason a page of
  -- notation can afford to spend the accent on it.
  local at = ui.playhead and (ui.playhead * doc.totalTicks) or nil
  local function playing(el)
    return at and el.abs and at >= el.abs and at < el.abs + el.ticks
  end

  Draw.page(penFor(dl), doc, x + 1.4 * SPACE, y, SPACE,
            { ink = MUSIC, staff = STAFF_LINE, ground = PAPER, accent = PLAYING },
            { highlight = Place.previewRunning() and playing or nil })
end

------------------------------------------------------------------------------
-- Shared controls
------------------------------------------------------------------------------

-- Straight, triplet or dotted. One setting shown on every panel, because a
-- block is in one feel or the other and the choice is the same question
-- wherever it is asked.
local function modRow()
  local m = chooser("ratemod", E.RATE_MODS, st.rateMod, 0, 72,
                    function(x) return x.name end,
                    function(x, i) return ({
                      "Notes fall where the grid says",
                      "Three in the space of two",
                      "Half as long again" })[i] end)
  if m then st.rateMod = m; touched() end
end

local function rateRow()
  dim("Rate")
  local r = chooser("rate", E.RATES, st.rate, 0, 54, function(x) return x.name end)
  if r then st.rate = r; touched() end
  ImGui.SameLine(ctx, 0, 16)
  modRow()
end

local function barsButtons()
  for i, b in ipairs(E.BAR_LENGTHS) do
    if i > 1 then ImGui.SameLine(ctx) end
    ImGui.PushID(ctx, "bars" .. i)
    if pick(b.name, math.abs(st.bars - b.bars) < 1e-9, 44) then
      st.bars = b.bars
      touched()
    end
    ImGui.PopID(ctx)
  end
end

local function barsRow()
  dim("Bars")
  barsButtons()
end

-- An arpeggio or a run is measured either by how many passes it plays or by a
-- length it fills, and which one is the user's to choose. Both say what a pass
-- costs, because the answer moves with the chord: a triad is three notes, a
-- thirteenth is seven.
local function lengthRow()
  local pass = E.passLength(st)
  dim("Length")

  local cur = 1
  for i, m in ipairs(E.LENGTH_MODES) do if m == st.lengthMode then cur = i end end
  local m = chooser("lenmode", E.LENGTH_MODES, cur, 0, 84)
  if m then st.lengthMode = E.LENGTH_MODES[m]; touched() end
  ImGui.SameLine(ctx, 0, 16)

  if st.lengthMode == "Bars" then
    barsButtons()
    ImGui.SameLine(ctx, 0, 14)
    dim(("%d notes a pass, cut wherever the bar ends"):format(pass))
  else
    local c, v = slider("repeats", "Repeats", st.repeats, 1, E.MAX_REPEATS, 150)
    if c then st.repeats = v; touched() end
    tip(("One pass is %d note%s, so this block is %d."):format(
        pass, pass == 1 and "" or "s", pass * st.repeats))
    ImGui.SameLine(ctx, 0, 14)
    dim(("%d notes a pass"):format(pass))
  end
end

local function commonTail(withOctaves, withOctave, withBars, withGate)
  local first = true
  local function gap() if not first then ImGui.SameLine(ctx, 0, 14) end; first = false end
  if withOctaves then
    gap()
    local c, v = slider("octaves", "Octaves", st.octaves, 1, 4, 110)
    if c then st.octaves = v; touched() end
  end
  if withOctave then
    gap()
    local c, v = slider("oct", "Octave", st.oct, -3, 3, 110)
    if c then st.oct = v; touched() end
  end
  if withGate then
    gap()
    local g, gv = slider("gate", "Gate %", st.gate, 5, 100, 130)
    if g then st.gate = gv; touched() end
  end
  if withBars then barsRow() end
end

-- Drawn in step 2, and again inside the Melody panel when a sustained note has
-- no shape to put there. It is the same setting either way - there is one
-- scale degree, shown where it is wanted.
local function degreeButtons(idPrefix)
  for d = 0, E.scaleLen(st) - 1 do
    if d > 0 then ImGui.SameLine(ctx) end
    ImGui.PushID(ctx, idPrefix .. d)
    if pick(E.degreeNumeral(st, d), st.degree == d, 62) then
      st.degree = d
      touched()
    end
    tip(E.degreeTitle(st, d) .. "  -  " .. E.noteName(st, d))
    ImGui.PopID(ctx)
  end
  ImGui.SameLine(ctx, 0, 16)
  dim(("%s   %s"):format(E.noteName(st, st.degree), E.degreeTitle(st, st.degree)))
end

------------------------------------------------------------------------------
-- Panels
------------------------------------------------------------------------------

local panels = {}

panels.Chord = function()
  dim("Family")
  local f = chooser("fam", E.FAMILIES, st.family, 0, 108)
  if f then
    st.family = f
    if f > 1 then
      for i, ch in ipairs(E.CHORDS) do
        if ch.fam == f then st.chord = i; break end
      end
    end
    touched()
  end

  dim("Chord")
  if st.family == 1 then
    local d = chooser("dia", E.DIATONIC, st.dia, 0, 74,
                      function(x) return x.name end,
                      function() return "Built from the scale itself, so it is always in key" end)
    if d then st.dia = d; touched() end
  else
    local shown, n = {}, 0
    for i, ch in ipairs(E.CHORDS) do
      if ch.fam == st.family then
        n = n + 1
        if n > 1 and (n - 1) % 8 ~= 0 then ImGui.SameLine(ctx) end
        ImGui.PushID(ctx, i)
        if pick(ch.sym, st.chord == i, 108) then st.chord = i; touched() end
        tip(ch.name .. "   -   semitones " .. table.concat(ch.iv, " "))
        ImGui.PopID(ctx)
      end
    end
  end

  ImGui.Dummy(ctx, 0, 4)
  dim("Inversion")
  local v = chooser("inv", E.INVERSIONS, st.inv + 1, 0, 58)
  if v then st.inv = v - 1; touched() end

  dim("Chop")
  local ch = chooser("chop", E.RATES, st.chop, 0, 54, function(x) return x.name end,
                     function(x) return "Strike the chord again every " .. x.name ..
                       " through the block" end)
  if ch then st.chop = ch; touched() end
  ImGui.SameLine(ctx, 0, 16)
  modRow()

  commonTail(false, true, true, true)
end

panels.Arpeggio = function()
  dim(("Chord:  %s   -   set it in the Chord tab"):format(E.chordLabel(st)))

  dim("Direction")
  local d = chooser("dir", E.DIRECTIONS, st.pattern, 0, 84)
  if d then st.pattern = d; touched() end

  rateRow()
  lengthRow()
  commonTail(true, true, false, true)
end

panels.Run = function()
  dim(("Runs the %s %s scale, starting on %s"):format(
    E.ROOTS[st.root].name, E.SCALES[st.scale].name, E.noteName(st, st.degree)))

  dim("Direction")
  local d = chooser("rundir", E.DIRECTIONS, st.runDir, 0, 84)
  if d then st.runDir = d; touched() end

  rateRow()
  lengthRow()
  commonTail(true, true, false, true)
end

panels.Melody = function()
  local held = E.isSustain(st)
  dim(held
      and "One note, held for the rate. The smallest melodic thing there is."
      or  "The two smallest moves in a melody: a step to the next scale note, or a leap past it.")

  dim("Interval")
  local i = chooser("mel", E.INTERVALS, st.interval, 0, 74,
                    function(x) return x.name end,
                    function(x) return x.hold and "One note, no move"
                      or (x.name == "2nd" and "The step" or "A leap") end)
  if i then st.interval = i; touched() end

  -- Nothing moves in a sustained note, so there is no direction to give it and
  -- no shape to put it in. The shape row makes way for the one thing that does
  -- decide the note: which degree it is.
  if held then
    dim("Scale degree")
    degreeButtons("meldeg")
  else
    ImGui.SameLine(ctx, 0, 16)
    if pick("Up", st.melDir == 1, 52) then st.melDir = 1; touched() end
    ImGui.SameLine(ctx)
    if pick("Down", st.melDir == 2, 52) then st.melDir = 2; touched() end

    dim("Shape")
    local sh = chooser("shape", E.SHAPES, st.shape, 0, 84, nil, function(_, k)
      return ({ "The move: two notes",
                "There and back: three notes",
                "Every scale note in between" })[k]
    end)
    if sh then st.shape = sh; touched() end
  end

  rateRow()
  commonTail(false, true, false, true)
end

panels.Bass = function()
  dim(("One note of the chord, on its own, low.   Chord:  %s"):format(E.chordLabel(st)))

  dim("Chord tone")
  local t = chooser("btone", E.BASS_TONES, st.bassTone, 0, 62)
  if t then st.bassTone = t; touched() end
  ImGui.SameLine(ctx, 0, 16)
  local c, v = slider("boct", "Octaves down", -st.bassOct, 0, 3, 130)
  if c then st.bassOct = -v; touched() end

  rateRow()
  commonTail(false, false, true, true)
end

panels.Drums = function()
  dim("One piece of the kit, hit at one rate. Stack a kit up by dropping in several.")

  dim("Piece")
  local p = chooser("drp", E.DRUM_PIECES, st.drumPiece, 0, 92,
                    function(x) return x.name end,
                    function(x) return "General MIDI note " .. x.note end)
  if p then st.drumPiece = p; touched() end

  local piece = E.DRUM_PIECES[st.drumPiece]
  if #piece.rates == 0 then
    -- Nothing to choose yet, and a control that does nothing is worse than no
    -- control, so say so instead of showing one.
    dim(("A single hit at the top of the bar. %s is still to be thought through.")
        :format(piece.name))
  else
    dim(piece.start > 0
        and ("Every  -  starting on beat %d"):format(piece.start + 1)
        or  "Every  -  starting at the top of the bar")
    for i, name in ipairs(piece.rates) do
      if i > 1 then ImGui.SameLine(ctx) end
      ImGui.PushID(ctx, "drate" .. i)
      if pick(name, st.drumRate == name, 54) then st.drumRate = name; touched() end
      ImGui.PopID(ctx)
    end
    ImGui.SameLine(ctx, 0, 16)
    modRow()

    dim("Shuffle")
    local c, v = slider("shuffle", "Shuffle %", st.shuffle, 0, 100, 150)
    if c then st.shuffle = v; touched() end
    tip("Pushes every second hit later. At 100 it lands two thirds of the way " ..
        "through the pair, which is the triplet feel a shuffle is named after.")
  end

  commonTail(false, false, true, false)
end

------------------------------------------------------------------------------
-- The frame
------------------------------------------------------------------------------

local function drawKey()
  heading(1, "Key")
  local r = chooser("root", E.ROOTS, st.root, 0, 44, function(x) return x.name end)
  if r then st.root = r; touched() end

  local s = chooser("scale", E.SCALES, st.scale, 8, 104, function(x) return x.name end)
  if s then
    st.scale = s
    st.degree = math.min(st.degree, E.scaleLen(st) - 1)
    touched()
  end
  stepGap()
end

local function drawDegree()
  heading(2, "Scale degree")
  degreeButtons("deg")
  stepGap()
end

local function drawActions()
  local block = ui.block
  heading(nil, block and block.name or "")

  local w = select(1, ImGui.GetContentRegionAvail(ctx))
  notation(block, math.max(220, w))

  if block then
    local note = ("%d notes  /  %.2f beats"):format(#block.notes, block.beats)
    if block.truncated then note = note .. "   (buffer full - shorten the block)" end
    dim(note)
  end

  ImGui.Dummy(ctx, 0, 2)

  if pick("Insert at cursor", false, 150) then
    local r = Place.insert(block)
    if r == Place.OK then say("Inserted at the edit cursor")
    elseif r == Place.NOTHING then say("Nothing to insert", true)
    else say("No track selected", true) end
  end

  ImGui.SameLine(ctx)
  if pick("Export .mid", false, 120) then
    local r, path = Place.export(block)
    if r == Place.OK then say("Wrote " .. tostring(path))
    elseif r == Place.NOTHING then say("Nothing to write", true)
    else say("Could not write the file", true) end
  end

  ImGui.SameLine(ctx, 0, 16)
  if pick(Place.previewRunning() and "Stop" or "Audition",
          Place.previewRunning(), 96) then
    if Place.previewRunning() then
      Place.previewStop()
    else
      Place.previewStart(block, Place.tempo())
    end
  end
  tip("Plays through the virtual keyboard, so a record-armed monitored track " ..
      "will sound it. Timing is a preview, not a performance.")

  ImGui.SameLine(ctx)
  local _
  _, ui.loop = ImGui.Checkbox(ctx, "Loop", ui.loop)

  if ui.status ~= "" then
    ImGui.PushStyleColor(ctx, ImGui.Col_Text, ui.warn and WARN or DIM)
    ImGui.Text(ctx, ui.status)
    ImGui.PopStyleColor(ctx, 1)
  end
end

local function frame()
  if ui.dirty then rebuild() end
  ui.playhead = Place.previewTick(nil, ui.loop)

  drawKey()
  drawDegree()

  heading(3, "Building block")
  for i, name in ipairs(E.CATEGORIES) do
    if i > 1 then ImGui.SameLine(ctx) end
    ImGui.PushID(ctx, "cat" .. i)
    if pick(name, st.cat == name, 96) then st.cat = name; touched() end
    ImGui.PopID(ctx)
  end

  stepGap()
  ;(panels[st.cat] or panels.Chord)()

  ImGui.Dummy(ctx, 0, 6)
  drawActions()
end

------------------------------------------------------------------------------
-- Running
------------------------------------------------------------------------------

local sectionID, cmdID

local function loop()
  ImGui.SetNextWindowSize(ctx, 1000, 760, ImGui.Cond_FirstUseEver)
  -- Solid rather than the half-transparent window ReaImGui opens by default.
  ImGui.SetNextWindowBgAlpha(ctx, 1.0)
  pushTheme()
  local visible, open = ImGui.Begin(ctx, TITLE, true)
  if visible then
    frame()
    ImGui.End(ctx)
  end
  popTheme()   -- outside the visible test: a push always needs its pop
  if open and not ImGui.IsKeyPressed(ctx, ImGui.Key_Escape) then
    reaper.defer(loop)
  end
end

local function shutdown()
  Place.previewStop()
  saveState()
  if sectionID then
    reaper.SetToggleCommandState(sectionID, cmdID, 0)
    reaper.RefreshToolbar2(sectionID, cmdID)
  end
end

local function main()
  loadState()
  local _, _, sid, cid = reaper.get_action_context()
  sectionID, cmdID = sid, cid
  reaper.SetToggleCommandState(sectionID, cmdID, 1)
  reaper.RefreshToolbar2(sectionID, cmdID)
  reaper.atexit(shutdown)
  reaper.set_action_options(1)
  ctx = ImGui.CreateContext(TITLE)
  -- One font, attached once, so the figures on the staff can be sized against
  -- the staff rather than against whatever the window's own font happens to be.
  penFont = ImGui.CreateFont("sans-serif", 16)
  ImGui.Attach(ctx, penFont)
  reaper.defer(loop)
end

main()
