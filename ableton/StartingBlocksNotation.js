/* Starting Blocks Notation - built by ableton/kit/build.py from ableton/device.json. Do not edit; edit the sources and rebuild. */
var DEVICE = {"generator": "starting-blocks", "notation": true, "title": "Starting Blocks Notation"};
DEVICE.files = {"adapters/common.lua": "--[[ Noterator - what every generator adapter shares.\n\n     The engines in the folders beside this one are the family's own, copied\n     unchanged from their repositories. An adapter is the only thing written\n     for Noterator: it turns one engine's settings into lists the app can show\n     and its output into parts the app can drop into a score. The app speaks\n     to every adapter the same way:\n\n       A.id, A.name, A.description\n       A.input                 \"none\", or \"selection\" when it works on music\n                               the user has selected\n       A.panel                 \"generate\", \"toolbox\", or nil: not shown\n       A.newState()            a fresh table of settings\n       A.settings(st, ctx)     the settings to show now, each\n                               { id, label, names = {...}, index, hint, hints = {...}, group }\n       A.set(st, id, index)    choose the index-th value of a setting\n       A.useKey(st, root, scale)   follow the score's key (1-based ScaleView indices)\n       A.generate(st, ctx, seed, count)\n                               { results = { { title, detail, beats, parts = {\n                                   { name, drums, instrument, notes = { {start, len, pitch, vel} } } } } },\n                                 message }\n\n     Times are quarter notes from the start of the result. `ctx` is\n       { root, scale, num, den, barBeats, bpm, inst, catalogueId, bars,\n         selection = { notes, beats, drums } } ]]\n\nlocal C = {}\n\nfunction C.indexOf(list, v)\n  for i, x in ipairs(list) do if x == v then return i end end\n  return nil\nend\n\n-- A setting: `values` are what the engine stores, `names` what the window\n-- shows. `when(st)` hides it when it does nothing (no dead controls).\nfunction C.setting(id, label, values, names, opts)\n  opts = opts or {}\n  local shown = {}\n  for i, v in ipairs(values) do shown[i] = names and names[i] or tostring(v) end\n  return { id = id, label = label, values = values, names = shown, hint = opts.hint,\n           hints = opts.hints, when = opts.when, group = opts.group, dynamic = opts.dynamic }\nend\n\nfunction C.onOff(id, label, opts)\n  return C.setting(id, label, { true, false }, { \"On\", \"Off\" }, opts)\nend\n\n-- What the window draws: the settings that apply to this state.\nfunction C.describe(list, st, ctx)\n  local out = {}\n  for _, s in ipairs(list) do\n    if not s.when or s.when(st) then\n      local values, names, hints = s.values, s.names, s.hints\n      if s.dynamic then values, names, hints = s.dynamic(st, ctx) end\n      local index = C.indexOf(values, st[s.id]) or 1\n      out[#out + 1] = { id = s.id, label = s.label, names = names, index = index,\n                        hint = s.hint or \"\", hints = hints or {}, group = s.group or \"\" }\n    end\n  end\n  return out\nend\n\nfunction C.set(list, st, id, index, ctx)\n  for _, s in ipairs(list) do\n    if s.id == id then\n      local values = s.values\n      if s.dynamic then values = s.dynamic(st, ctx) end\n      if values[index] ~= nil then st[id] = values[index] end\n      return true\n    end\n  end\n  return false\nend\n\n-- Notes as the app wants them, whatever the engine called the fields.\nfunction C.notes(list, chan)\n  local out = {}\n  for _, n in ipairs(list or {}) do\n    if not chan or (n.chan or 0) == chan then\n      out[#out + 1] = { start = n.start, len = n.len, pitch = n.pitch, vel = n.vel or 100 }\n    end\n  end\n  table.sort(out, function(a, b)\n    if a.start ~= b.start then return a.start < b.start end\n    return a.pitch < b.pitch\n  end)\n  return out\nend\n\nfunction C.finish(notes)\n  local e = 0\n  for _, n in ipairs(notes) do e = math.max(e, n.start + n.len) end\n  return e\nend\n\nreturn C\n", "adapters/index.lua": "return { \"adapters/starting_blocks.lua\" }\n", "adapters/starting_blocks.lua": "--[[ Starting Blocks, in Noterator.\n\n     The smallest useful pieces of music: a chord, an arpeggio, a run, a\n     melodic step or leap. One result per degree of the scale, so the whole\n     key can be auditioned at a glance and the block you want dropped in.\n\n     The engine also makes bass notes and single drums; Noterator leaves\n     those out (decision 0024) - Good Idea writes the drums and the bass. ]]\n\nlocal C = engine(\"adapters/common.lua\")\nlocal E = engine(\"starting-blocks/sb_engine.lua\")\n\nlocal A = {\n  id = \"starting-blocks\",\n  name = \"Starting Blocks\",\n  description = \"The smallest useful pieces - chords, arpeggios, runs, steps and leaps - on every degree of the key.\",\n  input = \"none\",\n  panel = \"toolbox\",\n}\n\nlocal function range(a, b) local out = {} for i = a, b do out[#out + 1] = i end return out end\nlocal function names(list) local out = {} for i, x in ipairs(list) do out[i] = x.name or x end return out end\nlocal function cat(...)\n  local set = {}\n  for _, c in ipairs({ ... }) do set[c] = true end\n  return function(st) return set[st.cat] == true end\nend\n\n-- The kinds offered here: the engine's own list, less Bass and Drums.\nlocal KINDS = {}\nfor _, c in ipairs(E.CATEGORIES) do\n  if c ~= \"Bass\" and c ~= \"Drums\" then KINDS[#KINDS + 1] = c end\nend\nlocal function keepKind(st)\n  for _, c in ipairs(KINDS) do if c == st.cat then return end end\n  st.cat = KINDS[1]\nend\n\nlocal barValues, barNames = {}, {}\nfor i, b in ipairs(E.BAR_LENGTHS) do barValues[i], barNames[i] = b.bars, b.name .. (b.bars == 1 and \" bar\" or \" bars\") end\n\nlocal LIST = {\n  C.setting(\"cat\", \"Block\", KINDS),\n  C.setting(\"family\", \"Chords\", range(1, #E.FAMILIES), E.FAMILIES, { when = cat(\"Chord\", \"Arpeggio\") }),\n  C.setting(\"dia\", \"Chord\", range(1, #E.DIATONIC), names(E.DIATONIC), {\n    when = function(st) return cat(\"Chord\", \"Arpeggio\")(st) and st.family == 1 end }),\n  C.setting(\"chord\", \"Chord\", {}, {}, {\n    when = function(st) return cat(\"Chord\", \"Arpeggio\")(st) and st.family > 1 end,\n    dynamic = function(st)\n      local values, shown = {}, {}\n      for i, ch in ipairs(E.CHORDS) do\n        if ch.fam == st.family then values[#values + 1], shown[#shown + 1] = i, ch.sym .. \"  \" .. ch.name end\n      end\n      return values, shown, {}\n    end }),\n  -- Only the inversions this chord has: two for a triad, three for a seventh,\n  -- up to six for a thirteenth (Starting Blocks' decision 0007).\n  C.setting(\"inv\", \"Inversion\", {}, {}, {\n    when = cat(\"Chord\", \"Arpeggio\"),\n    dynamic = function(st)\n      local values, shown = {}, E.inversionNames(st)\n      for i = 1, #shown do values[i] = i - 1 end\n      return values, shown, {}\n    end }),\n  C.setting(\"chop\", \"Strike every\", range(1, #E.RATES), names(E.RATES), { when = cat(\"Chord\") }),\n  C.setting(\"pattern\", \"Direction\", range(1, #E.DIRECTIONS), E.DIRECTIONS, { when = cat(\"Arpeggio\") }),\n  C.setting(\"runDir\", \"Direction\", range(1, #E.DIRECTIONS), E.DIRECTIONS, { when = cat(\"Run\") }),\n  C.setting(\"interval\", \"Interval\", range(1, #E.INTERVALS), names(E.INTERVALS), { when = cat(\"Melody\") }),\n  C.setting(\"melDir\", \"Direction\", { 1, 2 }, { \"Up\", \"Down\" }, { when = function(st) return st.cat == \"Melody\" and not E.isSustain(st) end }),\n  C.setting(\"shape\", \"Shape\", range(1, #E.SHAPES), E.SHAPES, { when = function(st) return st.cat == \"Melody\" and not E.isSustain(st) end }),\n  C.setting(\"rate\", \"Rate\", range(1, #E.RATES), names(E.RATES), { when = cat(\"Arpeggio\", \"Run\", \"Melody\") }),\n  C.setting(\"rateMod\", \"Feel\", range(1, #E.RATE_MODS), names(E.RATE_MODS), { when = cat(\"Chord\", \"Arpeggio\", \"Run\", \"Melody\") }),\n  C.setting(\"octaves\", \"Octaves\", range(1, 4), nil, { when = cat(\"Arpeggio\", \"Run\") }),\n  C.setting(\"lengthMode\", \"Measure by\", E.LENGTH_MODES, nil, { when = cat(\"Arpeggio\", \"Run\") }),\n  C.setting(\"repeats\", \"Repeats\", { 1, 2, 3, 4, 6, 8, 12, 16 }, nil, {\n    when = function(st) return (st.cat == \"Arpeggio\" or st.cat == \"Run\") and st.lengthMode == \"Repeats\" end }),\n  C.setting(\"bars\", \"Length\", barValues, barNames, {\n    when = function(st)\n      if st.cat == \"Arpeggio\" or st.cat == \"Run\" then return st.lengthMode == \"Bars\" end\n      return st.cat == \"Chord\"\n    end }),\n  C.setting(\"oct\", \"Octave\", range(-2, 2), { \"-2\", \"-1\", \"0\", \"+1\", \"+2\" }, { when = cat(\"Chord\", \"Arpeggio\", \"Run\", \"Melody\") }),\n}\n\nfunction A.newState() local st = E.newState() keepKind(st) return st end\nfunction A.settings(st, ctx) return C.describe(LIST, st, ctx) end\nfunction A.set(st, id, index, ctx)\n  C.set(LIST, st, id, index, ctx)\n  -- A new family starts on its first chord, so the chord shown is one of it.\n  if id == \"family\" and st.family > 1 and E.CHORDS[st.chord].fam ~= st.family then\n    for i, ch in ipairs(E.CHORDS) do if ch.fam == st.family then st.chord = i break end end\n  end\n  E.clampState(st)\nend\nfunction A.useKey(st, root, scale)\n  st.root, st.scale = root, scale\n  E.clampState(st)\nend\n\nfunction A.generate(st, ctx, seed, count)\n  st.barBeats = ctx.barBeats\n  E.clampState(st)\n  keepKind(st)\n  math.randomseed(seed)\n  local out = {}\n  local degrees = E.scaleLen(st)\n  for d = 0, degrees - 1 do\n    st.degree = d\n    local block = E.generate(st)\n    local title = (\"%s  %s\"):format(E.degreeNumeral(st, d), block.name)\n    -- A chord says the root it was built on, so the Chords lane names it as\n    -- it was made (decision 0046). A broken chord - an arpeggio - is a line,\n    -- and is read like one.\n    local root = st.cat == \"Chord\" and E.scalePitch(st, d) % 12 or nil\n    out[#out + 1] = { title = title, detail = E.noteName(st, d) .. \"  \" .. E.degreeTitle(st, d), beats = block.beats,\n                      root = root, parts = { { name = st.cat, drums = false, notes = C.notes(block.notes) } } }\n  end\n  st.degree = 0\n  return { results = out }\nend\n\nreturn A\n", "notation/sb_draw.lua": "--[[\n * sb_draw.lua - puts ink on what sb_notate.lua laid out.\n *\n * No `reaper.` and no `ImGui.` in this file either. It draws through a pen -\n * four calls, `line`, `poly`, `circle` and `text` - and the window hands it\n * one backed by a ReaImGui draw list. A test hands it one that writes down\n * what it was asked for, which is the only way an assertion about a stem or a\n * ledger line can exist at all.\n *\n * Everything here is in staff spaces until the last moment: a space is the\n * unit music is engraved in, every distance below is a fraction of one, and\n * `space` in pixels is the single number that scales the page.\n *\n * The symbols are Bravura's - clefs, heads, flags, rests, accidentals,\n * figures - baked into `sb_glyphs.lua` as polygons by `tools/bake_glyphs.py`\n * (0013). No font is loaded and none has to be installed: a REAPER user has\n * no reason to have one, and an app that looks wrong on someone else's\n * machine is worse than one that carries its own ink (0004). The lines -\n * staff, stems, beams, ledgers, bar lines, ties - are drawn here, to\n * Bravura's own engraving defaults.\n--]]\n\nlocal D = {}\n\nlocal N = nil\nfunction D.setNotate(n) N = n end\n\nlocal G = nil\nfunction D.setGlyphs(g) G = g end\n\n------------------------------------------------------------------------------\n-- Proportions\n------------------------------------------------------------------------------\n\n-- All of these are in staff spaces, and all of them are Bravura's published\n-- engraving defaults rather than numbers tuned by eye, so the lines are\n-- weighted the way the font's symbols were drawn to sit among.\n-- The head's width is `N.HEAD_RX`, not a constant here: the layout needs the\n-- same number to work out where the accidental in front of a head goes, and\n-- two copies of it would be two copies to keep in step.\nlocal STAFF_TH    = 0.13\nlocal LEDGER_TH   = 0.16\nlocal LEDGER_EXT  = 0.40      -- past each side of the head\nlocal STEM_TH     = 0.12\nlocal STEM_LEN    = 3.5\nlocal BEAM_TH     = 0.50\nlocal BEAM_GAP    = 0.25\nlocal BAR_TH      = 0.16\nlocal THICK_BAR   = 0.50\nlocal BAR_SEP     = 0.40\nlocal TIE_MID     = 0.22      -- how thick a tie is at its middle\nlocal TUPLET_TH   = 0.16\nlocal DOT_R       = 0.20\n-- The wedge over the note an audition is inside: half its width, its height,\n-- and how far its point stops above the highest ink.\nlocal MARK_W      = 0.45\nlocal MARK_H      = 0.60\nlocal MARK_GAP    = 0.30\n\n------------------------------------------------------------------------------\n-- Shapes\n------------------------------------------------------------------------------\n\nlocal function bezier(pts, x1, y1, cx1, cy1, cx2, cy2, x2, y2, steps)\n  steps = steps or 14\n  for i = 0, steps do\n    local t = i / steps\n    local u = 1 - t\n    local a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t\n    pts[#pts + 1] = a * x1 + b * cx1 + c * cx2 + d * x2\n    pts[#pts + 1] = a * y1 + b * cy1 + c * cy2 + d * y2\n  end\nend\n\n-- A filled shape, turned clockwise on the screen first. ReaImGui smooths a\n-- fill's edge by pushing a soft fringe out along each edge, and it decides\n-- which way is out from the winding: wound the other way, the fringe eats\n-- into the shape instead and a beam comes out thin and furry.\nlocal function fill(pen, pts, col)\n  local a, n = 0, #pts\n  for i = 1, n - 1, 2 do\n    local j = (i + 2 > n) and 1 or i + 2\n    a = a + pts[i] * pts[j + 1] - pts[j] * pts[i + 1]\n  end\n  if a < 0 then\n    local r = {}\n    for i = n - 1, 1, -2 do r[#r + 1] = pts[i]; r[#r + 1] = pts[i + 1] end\n    pts = r\n  end\n  pen.poly(pts, col)\nend\n\nlocal function glyphOf(name)\n  local g = G and G[name]\n  if not g then\n    error(G and (\"no glyph called \" .. tostring(name))\n            or \"sb_draw.lua was not handed its glyphs: call D.setGlyphs\", 3)\n  end\n  return g\nend\n\n-- Puts one of Bravura's symbols on the page with its SMuFL origin at (x, y).\n-- The polygons were baked clockwise and a positive scale keeps them that way,\n-- so they go straight to the pen. `sx` and `sy` stretch it, which only the\n-- brace and the tuplet's figure need.\nlocal function rings(pen, list, x, y, sp, col, sx, sy)\n  local kx, ky = (sx or 1) * sp, (sy or 1) * sp\n  for _, ring in ipairs(list) do\n    local pts = {}\n    for i = 1, #ring - 1, 2 do\n      pts[i]     = x + ring[i] * kx\n      pts[i + 1] = y + ring[i + 1] * ky\n    end\n    pen.poly(pts, col)\n  end\nend\n\nlocal function glyph(pen, name, x, y, sp, col, sx, sy)\n  rings(pen, glyphOf(name).fill, x, y, sp, col, sx, sy)\nend\n\n-- The same, centred across x rather than starting at it: a notehead, a rest\n-- and an accidental are placed by their middles in the layout.\nlocal function centred(pen, name, x, y, sp, col)\n  local g = glyphOf(name)\n  glyph(pen, name, x - (g.x1 + g.x2) / 2 * sp, y, sp, col)\nend\n\n------------------------------------------------------------------------------\n-- The page frame\n------------------------------------------------------------------------------\n\n-- A staff's geometry. `top` is the y of its top line; a position is in\n-- half-spaces above the bottom line, so a line is an even number and a space\n-- an odd one.\nlocal function staffAt(top, sp)\n  return {\n    top    = top,\n    bottom = top + 4 * sp,\n    sp     = sp,\n    y      = function(pos) return top + 4 * sp - pos * sp / 2 end,\n  }\nend\n\nlocal function staffLines(pen, s, x1, x2, col)\n  for i = 0, 4 do\n    local y = s.top + i * s.sp\n    pen.line(x1, y, x2, y, col, math.max(1, STAFF_TH * s.sp))\n  end\nend\n\n------------------------------------------------------------------------------\n-- Clefs\n------------------------------------------------------------------------------\n\n-- Each clef's SMuFL origin sits on the line it names: the G clef's spiral on\n-- the second line (Sec. 6), the F clef's head and dots about the fourth\n-- (Sec. 7). The kit's neutral clef claims no pitch and sits on the middle.\nlocal CLEF = {\n  treble = { glyph = \"gClef\",    pos = 2 },\n  bass   = { glyph = \"fClef\",    pos = 6 },\n  perc   = { glyph = \"percClef\", pos = 4 },\n}\n\n-- How far in from the start of the system a clef begins.\nlocal CLEF_IN = 0.6\n\nlocal function clef(pen, s, which, x, col)\n  local c = CLEF[which]\n  if c then glyph(pen, c.glyph, x, s.y(c.pos), s.sp, col) end\nend\n\n------------------------------------------------------------------------------\n-- Accidentals\n------------------------------------------------------------------------------\n\nlocal ACC = { [-2] = \"accidentalDoubleFlat\", [-1] = \"accidentalFlat\",\n              [0] = \"accidentalNatural\", [1] = \"accidentalSharp\",\n              [2] = \"accidentalDoubleSharp\" }\n\n------------------------------------------------------------------------------\n-- Rests\n------------------------------------------------------------------------------\n\n-- The whole rest hangs under the fourth line and the half rest sits on the\n-- third, both of them occupying the third space (Sec. 5). Everything shorter\n-- is centred on the middle line, which is where Bravura draws them to sit.\nlocal RESTS = { [1] = \"restWhole\", [2] = \"restHalf\", [4] = \"restQuarter\",\n                [8] = \"rest8th\", [16] = \"rest16th\", [32] = \"rest32nd\",\n                [64] = \"rest64th\" }\n\nlocal function rest(pen, s, x, den, dotCount, col)\n  local sp = s.sp\n  local d = 1\n  while d < den and d < 64 do d = d * 2 end\n  local name = RESTS[d] or \"rest64th\"\n  local y = s.y(den <= 1 and 6 or 4)\n  centred(pen, name, x, y, sp, col)\n  -- A dotted rest keeps its dot, in the third space like any other (Sec. 11).\n  local g = glyphOf(name)\n  for i = 1, dotCount or 0 do\n    pen.circle(x + ((g.x2 - g.x1) / 2 + 0.1 + 0.5 * i) * sp, s.y(5), DOT_R * sp, col, true)\n  end\nend\n\n------------------------------------------------------------------------------\n-- Noteheads, stems, flags\n------------------------------------------------------------------------------\n\nlocal HEADS = { [1] = \"noteheadWhole\", [2] = \"noteheadHalf\" }\nlocal CROSS = { [1] = \"noteheadXWhole\", [2] = \"noteheadXHalf\" }\n\nlocal function notehead(pen, x, y, sp, kind, den, col, ground)\n  if kind == \"cross\" or kind == \"open\" then\n    centred(pen, CROSS[den] or \"noteheadXBlack\", x, y, sp, col)\n    if kind == \"open\" then\n      pen.circle(x, y - 1.0 * sp, 0.30 * sp, col, false)\n    end\n    return\n  end\n\n  local name = HEADS[den] or \"noteheadBlack\"\n  local g = glyphOf(name)\n  local left = x - (g.x1 + g.x2) / 2 * sp\n  if g.holes then\n    -- The counter of an open head is opaque, so the staff line it sits on\n    -- stops at its edge rather than running through the hole: the head is\n    -- filled whole and its counter punched back out with the paper.\n    rings(pen, g.outer, left, y, sp, col)\n    rings(pen, g.holes, left, y, sp, ground)\n  else\n    rings(pen, g.fill, left, y, sp, col)\n  end\nend\n\n-- One flag per beam the value would carry, always on the right of the stem\n-- (Sec. 1). Bravura draws one symbol for each count, hung from the stem's tip\n-- with its origin on the stem's left edge.\nlocal FLAGS = { \"8th\", \"16th\", \"32nd\", \"64th\" }\n\nlocal function flag(pen, sx, tip, sp, n, dir, col)\n  local name = \"flag\" .. FLAGS[math.min(n, #FLAGS)] .. ((dir == \"up\") and \"Up\" or \"Down\")\n  glyph(pen, name, sx - STEM_TH * sp / 2, tip, sp, col)\nend\n\n-- The dot goes on a space, never on a line: a head on a line pushes its dot to\n-- the space above (Sec. 11).\nlocal function dots(pen, s, x, pos, n, col)\n  local sp = s.sp\n  local at = (pos % 2 == 0) and (pos + 1) or pos\n  for i = 1, n do\n    pen.circle(x + (0.05 + 0.5 * i) * sp, s.y(at), DOT_R * sp, col, true)\n  end\nend\n\n------------------------------------------------------------------------------\n-- A chord\n------------------------------------------------------------------------------\n\nlocal function chord(pen, s, el, x, col, ground)\n  local sp = s.sp\n  local den, dotCount = el.value.den, el.value.dots or 0\n  local rx = (den <= 1) and N.WHOLE_RX or N.HEAD_RX\n  local stemUp = el.stem == \"up\"\n\n  -- Ledger lines first, so the heads sit on top of them. The kit gets them\n  -- too: a hi-hat is written above the staff and needs its line like anything\n  -- else up there.\n  local half = (rx + LEDGER_EXT) * sp\n  for _, h in ipairs(el.heads) do\n    if h.pos < 0 then\n      for p = -2, h.pos, -2 do\n        pen.line(x - half, s.y(p), x + half, s.y(p), col, math.max(1, LEDGER_TH * sp))\n      end\n    elseif h.pos > 8 then\n      for p = 10, h.pos, 2 do\n        pen.line(x - half, s.y(p), x + half, s.y(p), col, math.max(1, LEDGER_TH * sp))\n      end\n    end\n  end\n\n  -- The accidentals go exactly where the layout put them. It knows which\n  -- heads were pushed across the stem and how many columns the accidentals\n  -- need; drawing them from a running offset here is what once put a sharp\n  -- underneath a notehead.\n  for _, h in ipairs(el.heads) do\n    if h.acc and h.accDX and ACC[h.acc] then\n      centred(pen, ACC[h.acc], x + h.accDX * sp, s.y(h.pos), sp, col)\n    end\n  end\n\n  -- The dots line up after the rightmost head of the chord, so a head\n  -- crossed to the right of the stem does not land on its neighbours' dots.\n  local right = x + rx * sp\n  for _, h in ipairs(el.heads) do\n    -- Which side a crossed head goes is the layout's answer, not one worked\n    -- out again from the stem: see `el.sideDir` in sb_notate.lua.\n    local hx = x + ((h.side == 1) and (el.sideDir or 1) * 2 * rx * sp or 0)\n    notehead(pen, hx, s.y(h.pos), sp, h.glyph or \"normal\", den, col, ground)\n    right = math.max(right, hx + rx * sp)\n  end\n  if dotCount > 0 then\n    for _, h in ipairs(el.heads) do dots(pen, s, right, h.pos, dotCount, col) end\n  end\n\n  if el.stem then\n    local lo, hi = el.heads[1].pos, el.heads[#el.heads].pos\n    local sx = x + (stemUp and rx * sp - STEM_TH * sp / 2\n                           or -rx * sp + STEM_TH * sp / 2)\n    el.stemX   = sx\n    el.stemFrom = stemUp and s.y(lo) or s.y(hi)\n\n    -- A beamed note's stem is not drawn here. How long it is depends on where\n    -- the beam ends up, and that is not known until the whole group has been\n    -- seen - drawing a guess first leaves the guess on the page under the beam.\n    if el.beam then return end\n\n    -- A stem is an octave long, measured from the head at the far end of the\n    -- chord from the stem's tip - the lowest under an upward stem. Measuring\n    -- from the near head instead makes a triad's stem half as long again as it\n    -- should be, which is what a bar of chopped chords shows at a glance.\n    -- A chord taller than an octave still has to clear its own top head.\n    local to\n    if stemUp then\n      to = math.min(s.y(lo) - STEM_LEN * sp, s.y(hi + 2))\n      to = math.min(to, s.y(4))          -- and it reaches the middle line\n    else\n      to = math.max(s.y(hi) + STEM_LEN * sp, s.y(lo - 2))\n      to = math.max(to, s.y(4))\n    end\n    local n = N and N.hooks(el.value) or 0\n    -- A flag for a thirty-second or shorter would run into its own head on a\n    -- stem of the ordinary length, so the stem grows to carry it.\n    if n > 2 then to = to + (stemUp and -1 or 1) * (n - 2) * 0.75 * sp end\n    pen.line(sx, el.stemFrom, sx, to, col, math.max(1, STEM_TH * sp))\n    el.stemTip = to\n    if n > 0 then flag(pen, sx, to, sp, n, el.stem, col) end\n  end\nend\n\n------------------------------------------------------------------------------\n-- Beams\n------------------------------------------------------------------------------\n\n-- A beamed group is drawn after its notes, because where the beam sits decides\n-- how long every stem in the group is, and the stems were drawn to reach it.\nlocal function beamGroup(pen, s, run, col)\n  local sp = s.sp\n  local first, last = run[1], run[#run]\n  if not (first.stemX and last.stemX) then return end\n\n  local up = run.stem == \"up\"\n  local sign = up and -1 or 1\n  local span = last.stemX - first.stemX\n\n  -- Two heads matter per chord: the far one, which sets how long the stem\n  -- wants to be, and the near one, which the beam has to clear whatever the\n  -- far one says.\n  local reach, far = {}, {}\n  for i, el in ipairs(run) do\n    reach[i] = up and s.y(el.heads[#el.heads].pos) or s.y(el.heads[1].pos)\n    far[i]   = up and s.y(el.heads[1].pos) or s.y(el.heads[#el.heads].pos)\n  end\n\n  -- The beam leans the way the notes do, but only part of the way and never\n  -- past a quarter turn. A beam that followed the notes exactly would stand on\n  -- end over a run of a scale, which is the shape this app makes most often.\n  -- A quarter of the interval the group covers, and never more than a space\n  -- and a bit. A run of a scale in sixteenths is the shape that settles this:\n  -- at anything like the full interval its beams stand on end.\n  local slope = (reach[#reach] - reach[1]) * 0.25\n  local cap   = math.min(1.2 * sp, math.abs(span) * 0.22)\n  if slope >  cap then slope =  cap end\n  if slope < -cap then slope = -cap end\n\n  -- Then slide the whole beam out until two things hold for every chord in the\n  -- group: its stem is a full one measured from the far head, and the beam\n  -- still clears the near head by a space. A rising run needs the first; a\n  -- beamed chord needs the second.\n  local MIN, CLEAR = STEM_LEN * sp, 1.0 * sp\n  local base\n  for i, el in ipairs(run) do\n    local t = (span == 0) and 0 or (el.stemX - first.stemX) / span\n    local a = far[i]   + sign * MIN   - slope * t\n    local b = reach[i] + sign * CLEAR - slope * t\n    local want = up and math.min(a, b) or math.max(a, b)\n    if not base then base = want\n    elseif up and want < base then base = want\n    elseif not up and want > base then base = want end\n  end\n\n  local function yAt(x)\n    if span == 0 then return base end\n    return base + slope * (x - first.stemX) / span\n  end\n\n  for i, el in ipairs(run) do\n    local y = yAt(el.stemX)\n    pen.line(el.stemX, el.stemFrom, el.stemX, y, col, math.max(1, STEM_TH * sp))\n    el.beamTip, el.stemTip = y, y\n  end\n\n  local most = 0\n  for _, el in ipairs(run) do most = math.max(most, N and N.hooks(el.value) or 1) end\n\n  for level = 0, most - 1 do\n    local dy = sign * level * (BEAM_TH + BEAM_GAP) * sp\n    -- Each beam level runs only under the notes that actually carry it, which\n    -- is what turns a dotted eighth and a sixteenth into a beam and a stub\n    -- rather than two full beams.\n    local i = 1\n    while i <= #run do\n      local has = (N and N.hooks(run[i].value) or 0) > level\n      if not has then i = i + 1\n      else\n        local j = i\n        while j + 1 <= #run and (N and N.hooks(run[j + 1].value) or 0) > level do\n          j = j + 1\n        end\n        -- Out to the stems' outer edges, so no stem pokes past its beam.\n        local xa, xb = run[i].stemX - STEM_TH * sp / 2, run[j].stemX + STEM_TH * sp / 2\n        if i == j then\n          -- A stub, pointing back into the group it belongs to.\n          local dir = (i > 1) and -1 or 1\n          xa = run[i].stemX + (dir > 0 and -1 or 1) * STEM_TH * sp / 2\n          xb = xa + dir * 1.1 * sp\n          if xb < xa then xa, xb = xb, xa end\n        end\n        local ya, yb = yAt(xa) + dy, yAt(xb) + dy\n        local t = sign * BEAM_TH * sp\n        fill(pen, { xa, ya, xb, yb, xb, yb - t, xa, ya - t }, col)\n        i = j + 1\n      end\n    end\n  end\nend\n\n------------------------------------------------------------------------------\n-- Ties\n------------------------------------------------------------------------------\n\n-- A tie is a crescent, thin at its ends and thickest at its middle, the way\n-- an engraver's tie is - a stroke of even weight reads as a slur drawn with a\n-- ruler. It starts and ends a little inside the two heads' centres and\n-- arches away from the stems.\nlocal function tie(pen, s, x1, y1, x2, y2, below, col)\n  local sp = s.sp\n  local dir = below and 1 or -1\n  local xa, xb = x1 + 0.3 * sp, x2 - 0.3 * sp\n  local ya, yb = y1 + dir * 0.45 * sp, y2 + dir * 0.45 * sp\n  local len = math.max(xb - xa, 0.5 * sp)\n  local bow = math.min(0.9, 0.3 + len / sp * 0.05) * sp\n  local inner = bow - TIE_MID * sp\n  local pts = {}\n  bezier(pts, xa, ya, xa + len * 0.25, ya + dir * bow * 4 / 3,\n              xb - len * 0.25, yb + dir * bow * 4 / 3, xb, yb, 16)\n  local back = {}\n  bezier(back, xb, yb, xb - len * 0.25, yb + dir * inner * 4 / 3,\n               xa + len * 0.25, ya + dir * inner * 4 / 3, xa, ya, 16)\n  -- The two curves share their ends; dropping the repeats keeps the outline\n  -- a simple polygon.\n  for k = 3, #back - 2 do pts[#pts + 1] = back[k] end\n  fill(pen, pts, col)\nend\n\n------------------------------------------------------------------------------\n-- Key and time signatures\n------------------------------------------------------------------------------\n\n-- Where each accidental of a signature sits, in half-spaces above the bottom\n-- line. Two rows per clef, because a signature is written in one fixed shape\n-- and the shape is not the same for sharps as for flats.\nlocal SIG_POS = {\n  treble = { sharp = { 8, 5, 9, 6, 3, 7, 4 }, flat = { 4, 7, 3, 6, 2, 5, 1 } },\n  bass   = { sharp = { 6, 3, 7, 4, 1, 5, 2 }, flat = { 2, 5, 1, 4, 0, 3, -1 } },\n}\n\nlocal function keySignature(pen, s, clef, sig, x, col)\n  if clef == \"perc\" or sig.count == 0 then return x end\n  local rows = SIG_POS[clef]\n  if not rows then return x end\n  local list = rows[sig.kind]\n  local name = (sig.kind == \"flat\") and \"accidentalFlat\" or \"accidentalSharp\"\n  local step = (N and N.SIG_STEP or 1.0) * s.sp\n  for i = 1, math.min(sig.count, 7) do\n    centred(pen, name, x + step / 2, s.y(list[i]), s.sp, col)\n    x = x + step\n  end\n  return x + 0.5 * s.sp\nend\n\n-- A row of Bravura's figures, centred on x with their middles on y. The time\n-- signature's figures are drawn like everything else now, so they scale with\n-- the staff on every ReaImGui rather than only on one that can size text.\nlocal function figures(pen, prefix, value, x, y, sp, col, k)\n  k = k or 1\n  local str = tostring(value)\n  local w, gap = 0, 0.08\n  for c in str:gmatch(\"%d\") do w = w + glyphOf(prefix .. c).x2 * k + gap end\n  w = w - gap\n  local at = x - w * sp / 2\n  for c in str:gmatch(\"%d\") do\n    local g = glyphOf(prefix .. c)\n    glyph(pen, prefix .. c, at, y, sp, col, k, k)\n    at = at + (g.x2 * k + gap) * sp\n  end\nend\n\nlocal function timeSignature(pen, s, time, x, col)\n  local sp = s.sp\n  local w  = (N and N.timeWidth and N.timeWidth(time) or 2.4) * sp\n  figures(pen, \"timeSig\", time.num, x + w / 2, s.y(6), sp, col)\n  figures(pen, \"timeSig\", time.den, x + w / 2, s.y(2), sp, col)\n  return x + w\nend\n\n------------------------------------------------------------------------------\n-- The page\n------------------------------------------------------------------------------\n\n-- How far above the top line and below the bottom line this document actually\n-- reaches: ledger lines, a beam over a high run, the figure over a tuplet. A\n-- page reserved at the height of its staves alone clips exactly the things\n-- that are furthest from them.\nfunction D.margins(doc)\n  local above, below = 1.0, 1.0\n  for _, m in ipairs(doc.measures or {}) do\n    for _, staff in ipairs(m.staves or {}) do\n      for _, el in ipairs(staff.elements or {}) do\n        for _, h in ipairs(el.heads or {}) do\n          above = math.max(above, (h.pos - 8) / 2 + 1.2)\n          below = math.max(below, (0 - h.pos) / 2 + 1.2)\n        end\n        if el.tieOut and el.heads and el.heads[1] then\n          -- A tie bows out past the outermost heads.\n          above = math.max(above, (el.heads[#el.heads].pos - 8) / 2 + 1.7)\n          below = math.max(below, (0 - el.heads[1].pos) / 2 + 1.7)\n        end\n        if el.kind == \"chord\" then\n          -- A stem, and then the hook or the beam and its figure on top of it.\n          local reach = STEM_LEN + 1.8\n                        + math.max(0, (N and N.hooks(el.value) or 0) - 2) * 0.75\n          for _, h in ipairs(el.heads or {}) do\n            if el.stem == \"up\" then\n              above = math.max(above, (h.pos - 8) / 2 + reach)\n            elseif el.stem == \"down\" then\n              below = math.max(below, (0 - h.pos) / 2 + reach)\n            end\n          end\n        end\n      end\n    end\n  end\n  return above, below\nend\n\n-- How tall a page will be, so the window can reserve the room before drawing.\nfunction D.height(doc, sp, opts)\n  opts = opts or {}\n  local staves = #doc.staves\n  local system = staves * 4 * sp + (staves - 1) * (opts.staffGap or 4.6) * sp\n  local gap    = (opts.systemGap or 3.2) * sp\n  local n      = doc.systems and #doc.systems or 1\n  local above, below = D.margins(doc)\n  return n * (system + (above + below) * sp) + (n - 1) * gap\n         + 2 * (opts.pad or 1.2) * sp\nend\n\n-- Draws the whole document. `col` carries the four colours the page uses:\n-- the ink, the staff lines, the ground the open noteheads punch through, and\n-- the accent a highlighted note takes.\n-- The gap between the staves of a great staff is wide on purpose. At a couple\n-- of spaces the two of them read as one ten-line staff and a chord spanning\n-- middle C looks like a single stack of notes, which is the one thing the\n-- great staff exists to avoid.\nfunction D.page(pen, doc, x0, y0, sp, col, opts)\n  opts = opts or {}\n  local staffGap  = (opts.staffGap or 4.6) * sp\n  local systemGap = (opts.systemGap or 3.2) * sp\n  local pad       = (opts.pad or 1.2) * sp\n  local ink       = col.ink\n  local lineCol   = col.staff or col.ink\n  local ground    = col.ground\n\n  -- The same margins D.height reserved, so what was measured is what is drawn.\n  local above, below = D.margins(doc)\n  local y = y0 + pad + above * sp\n  local systems = doc.systems or { doc.measures }\n\n  for _, sys in ipairs(systems) do\n    local scale = sys.scale or 1\n    local staffTops = {}\n    for i = 1, #doc.staves do\n      staffTops[i] = y + (i - 1) * (4 * sp + staffGap)\n    end\n    local sysBottom = staffTops[#doc.staves] + 4 * sp\n\n    -- How wide this system runs, so the staff lines and the final bar line\n    -- stop in the same place.\n    local total = doc.headWidth * sp\n    for _, m in ipairs(sys) do total = total + m.width * sp * scale end\n    local right = x0 + total\n\n    -- The clef, the signature and the time all come out of the same numbers\n    -- sb_notate reserved room for, so the first note of the bar lands exactly\n    -- where the layout said it would.\n    for i, sdef in ipairs(doc.staves) do\n      local s = staffAt(staffTops[i], sp)\n      staffLines(pen, s, x0, right, lineCol)\n\n      clef(pen, s, sdef.clef, x0 + CLEF_IN * sp, ink)\n      local after = keySignature(pen, s, sdef.clef, doc.sig,\n                                 x0 + (N and N.CLEF_WIDTH or 4.0) * sp, ink)\n      timeSignature(pen, s, doc.time, after, ink)\n    end\n\n    -- The brace and the bar line that join a great staff into one system.\n    -- Bravura's brace is drawn for one staff; it is stretched to the system's\n    -- height and widened in proportion, but less, so a tall one stays a brace\n    -- rather than becoming a wedge.\n    if #doc.staves > 1 then\n      local top, bot = staffTops[1], sysBottom\n      pen.line(x0, top, x0, bot, ink, math.max(1, BAR_TH * sp))\n      local g = glyphOf(\"brace\")\n      local ky = (bot - top) / ((g.y2 - g.y1) * sp)\n      local kx = math.sqrt(ky) * 1.6\n      glyph(pen, \"brace\", x0 - 0.35 * sp - g.x2 * kx * sp, bot - g.y2 * ky * sp,\n            sp, ink, kx, ky)\n    end\n\n    local mx = x0 + doc.headWidth * sp\n    local marks = {}\n    for mi, m in ipairs(sys) do\n      local mw = m.width * sp * scale\n\n      for si, sdef in ipairs(doc.staves) do\n        local s = staffAt(staffTops[si], sp)\n        local staff = m.staves[si]\n        if staff then\n          for _, el in ipairs(staff.elements) do\n            local ex = mx + el.x * sp * scale\n            if el.kind == \"rest\" then\n              rest(pen, s, ex, el.measureRest and 1 or el.value.den,\n                   el.value.dots or 0, ink)\n            else\n              local hot = opts.highlight and opts.highlight(el)\n              local c = hot and col.accent or ink\n              chord(pen, s, el, ex, c, ground)\n              if hot then marks[ex] = true end\n              el.screenX = ex\n            end\n          end\n\n          -- Beams, then the figures over the tuplets, then the ties.\n          local drawn = {}\n          for _, el in ipairs(staff.elements) do\n            if el.beam and not drawn[el.beam] and el.beam[1].stemX then\n              drawn[el.beam] = true\n              beamGroup(pen, s, el.beam, ink)\n            end\n          end\n\n          for _, g in ipairs(staff.tuplets or {}) do\n            local a, b = g.elements[1], g.elements[#g.elements]\n            if a.stemX and b.stemX then\n              local up = a.stem == \"up\"\n              local ty = up and math.min(a.beamTip or a.stemTip or s.y(8),\n                                         b.beamTip or b.stemTip or s.y(8)) - 1.0 * sp\n                             or math.max(a.beamTip or a.stemTip or s.y(0),\n                                         b.beamTip or b.stemTip or s.y(0)) + 1.0 * sp\n              local xa, xb = a.stemX, b.stemX\n              if g.bracket then\n                local th = math.max(1, TUPLET_TH * sp)\n                local drop = up and 0.5 * sp or -0.5 * sp\n                pen.line(xa, ty + drop, xa, ty, ink, th)\n                pen.line(xb, ty + drop, xb, ty, ink, th)\n                local mid = (xa + xb) / 2\n                pen.line(xa, ty, mid - 0.7 * sp, ty, ink, th)\n                pen.line(mid + 0.7 * sp, ty, xb, ty, ink, th)\n              end\n              -- Bravura's tuplet figures stand on their baseline and are a\n              -- space and a half tall; at eight tenths they sit centred on\n              -- the bracket's line.\n              figures(pen, \"tuplet\", g.n, (xa + xb) / 2, ty + 0.6 * sp, sp, ink, 0.8)\n            end\n          end\n\n          -- A tie runs to the note it holds into: the next in the bar, or\n          -- across the bar line to the first of the next bar when that is on\n          -- the same system. At the end of a system it runs out to the edge.\n          for i, el in ipairs(staff.elements) do\n            if el.tieOut and el.screenX then\n              local nxt = staff.elements[i + 1]\n              local x2 = nxt and nxt.screenX\n              local follow = sys[mi + 1] and sys[mi + 1].staves[si]\n              if not x2 and follow and follow.elements[1] then\n                x2 = mx + mw + follow.elements[1].x * sp * scale\n              end\n              x2 = x2 or (mx + mw - 0.6 * sp)\n              local rx = ((el.value.den <= 1) and N.WHOLE_RX or N.HEAD_RX) * sp\n              local n = #el.heads\n              -- Every note of a tied chord is tied. One note bows away from\n              -- its stem; in a chord the lower half bow down and the upper\n              -- half up, each starting beside its head rather than under it.\n              for k, h in ipairs(el.heads) do\n                local below\n                if n == 1 then below = el.stem == \"up\"\n                else below = k <= n / 2 end\n                local y = s.y(h.pos)\n                if n == 1 then\n                  tie(pen, s, el.screenX, y, x2, y, below, ink)\n                else\n                  tie(pen, s, el.screenX + rx - 0.1 * sp, y + (below and -0.25 or 0.25) * sp,\n                      x2 - rx + 0.1 * sp, y + (below and -0.25 or 0.25) * sp, below, ink)\n                end\n              end\n            end\n          end\n        end\n      end\n\n      -- One bar line down the whole system, so a great staff reads as one.\n      mx = mx + mw\n      local last = (mi == #sys)\n      local top, bot = staffTops[1], sysBottom\n      if last and sys == systems[#systems] then\n        -- The final bar: a thin line and a thick one, the thick flush with\n        -- where the staff stops.\n        local thinX = mx - (THICK_BAR + BAR_SEP + BAR_TH / 2) * sp\n        pen.line(thinX, top, thinX, bot, ink, math.max(1, BAR_TH * sp))\n        fill(pen, { mx - THICK_BAR * sp, top, mx, top, mx, bot, mx - THICK_BAR * sp, bot }, ink)\n      else\n        pen.line(mx, top, mx, bot, ink, math.max(1, BAR_TH * sp))\n      end\n    end\n\n    -- The note sounding is not told by its colour alone: a small wedge in the\n    -- same accent points down at it from above the system, in the room the\n    -- page already keeps there (the pad over the first system, the gap\n    -- between systems under the others), so it is found without telling\n    -- yellow from white.\n    local point = staffTops[1] - above * sp - MARK_GAP * sp\n    for at in pairs(marks) do\n      fill(pen, { at - MARK_W * sp, point - MARK_H * sp, at + MARK_W * sp, point - MARK_H * sp,\n                  at, point }, col.accent)\n    end\n\n    y = sysBottom + below * sp + systemGap + above * sp\n  end\n\n  -- What was drawn is what the window was told to reserve, by construction:\n  -- two expressions for one number is two expressions to keep in step, and\n  -- the one that drifts is always the one nobody is looking at.\n  return D.height(doc, sp, opts)\nend\n\nreturn D\n", "notation/sb_glyphs.lua": "--[[\n * sb_glyphs.lua - the music's symbols, as polygons.\n *\n * GENERATED by tools/bake_glyphs.py from Bravura. Do not edit by hand: change\n * the tool and run it again.\n *\n * Bravura is copyright (c) 2015, Steinberg Media Technologies GmbH\n * (http://www.steinberg.net/), with Reserved Font Name \"Bravura\", and is\n * licensed under the SIL Open Font License, Version 1.1. These outlines are\n * derived from it and are distributed under that licence too; its text is in\n * sb_glyphs-OFL.txt beside this file. The licence covers this file only - the\n * rest of the script is not font software and is not affected by it.\n *\n * Units are staff spaces, y runs down, and (0, 0) is the glyph's SMuFL\n * origin. Every polygon in `fill` is simple, has no holes and is clockwise\n * on screen; together they cover the glyph, overlapping where it was cut.\n * The open noteheads also carry `outer` and `holes`, so the page can punch\n * a counter with the paper instead of leaving it see-through.\n--]]\n\nreturn {\n  gClef = {\n    x1 = 0, y1 = -4.392, x2 = 2.684, y2 = 2.631,\n    fill = {\n      {2.651,0.222,2.611,0.342,2.556,0.455,2.511,0.525,2.461,0.59,2.376,0.681,2.313,0.736,2.244,0.786,2.133,0.853,1.972,0.926,1.957,0.942,1.96,0.976,2.016,1.296,2.051,1.526,2.07,1.707,2.076,1.832,2.07,1.957,2.052,2.068,2.023,2.167,2.005,2.212,1.963,2.293,1.914,2.364,1.887,2.395,1.829,2.451,1.734,2.518,1.634,2.567,1.566,2.591,1.499,2.609,1.372,2.628,1.227,2.631,1.115,2.62,1.063,2.611,0.968,2.586,0.884,2.554,0.811,2.514,0.778,2.491,0.719,2.443,0.67,2.39,0.629,2.333,0.596,2.275,0.559,2.184,0.543,2.124,0.53,2.036,0.529,1.948,0.536,1.885,0.55,1.825,0.571,1.769,0.614,1.691,0.672,1.626,0.743,1.574,0.826,1.538,0.922,1.521,1.023,1.525,1.084,1.539,1.164,1.577,1.21,1.611,1.249,1.652,1.281,1.699,1.317,1.778,1.336,1.866,1.34,1.928,1.335,1.997,1.322,2.059,1.29,2.137,1.26,2.18,1.227,2.216,1.19,2.247,1.132,2.281,0.993,2.33,0.959,2.346,0.945,2.365,0.949,2.392,0.964,2.412,0.988,2.432,1.023,2.45,1.068,2.465,1.154,2.482,1.264,2.488,1.374,2.482,1.463,2.467,1.554,2.44,1.642,2.397,1.698,2.357,1.749,2.308,1.795,2.249,1.815,2.215,1.85,2.137,1.865,2.094,1.887,1.997,1.894,1.943,1.9,1.799,1.885,1.615,1.843,1.319,1.785,0.993,1.781,0.985,1.768,0.979,1.639,0.998,1.537,1.006,1.456,1.008,1.313,1.003,1.177,0.989,0.988,0.951,0.871,0.915,0.709,0.847,0.565,0.762,0.437,0.664,0.325,0.553,0.23,0.43,0.152,0.298,0.09,0.158,0.056,0.05,0.329,0.05,0.33,0.059,0.347,0.147,0.373,0.232,0.426,0.35,0.471,0.424,0.524,0.492,0.617,0.586,0.687,0.642,0.764,0.692,0.848,0.736,0.937,0.774,1.033,0.806,1.135,0.831,1.242,0.849,1.354,0.86,1.512,0.863,1.609,0.857,1.714,0.84,1.747,0.83,1.752,0.826,1.755,0.811,1.628,0.05,1.799,0.05,1.916,0.728,1.925,0.761,1.93,0.766,1.944,0.767,1.98,0.752,2.039,0.719,2.095,0.682,2.146,0.641,2.192,0.595,2.233,0.546,2.285,0.466,2.324,0.379,2.348,0.284,2.356,0.184,2.346,0.066,2.341,0.05,2.678,0.05,2.676,0.093},\n      {1.096,0.173,1.13,0.251,1.179,0.322,1.239,0.384,1.309,0.434,1.391,0.474,1.408,0.486,1.419,0.502,1.419,0.521,1.408,0.543,1.393,0.552,1.362,0.556,1.3,0.544,1.232,0.52,1.17,0.492,1.112,0.458,1.058,0.417,0.985,0.347,0.942,0.293,0.904,0.234,0.858,0.136,0.835,0.064,0.832,0.05,1.074,0.05,1.081,0.118},\n      {1.642,-1.011,1.825,-1.003,1.924,-0.989,2.019,-0.966,2.15,-0.915,2.231,-0.872,2.306,-0.822,2.375,-0.765,2.438,-0.702,2.494,-0.633,2.543,-0.56,2.585,-0.482,2.635,-0.358,2.668,-0.227,2.68,-0.136,2.684,-0.044,2.676,0.093,2.651,0.222,2.641,0.25,2.351,0.25,2.356,0.184,2.346,0.066,2.316,-0.045,2.268,-0.146,2.206,-0.236,2.156,-0.289,2.101,-0.337,2.041,-0.378,1.977,-0.412,1.909,-0.438,1.838,-0.457,1.764,-0.468,1.729,-0.466,1.723,-0.462,1.717,-0.449,1.72,-0.412,1.834,0.25,1.661,0.25,1.552,-0.404,1.542,-0.435,1.529,-0.444,1.491,-0.441,1.439,-0.426,1.377,-0.403,1.293,-0.358,1.221,-0.304,1.162,-0.24,1.117,-0.167,1.087,-0.087,1.076,-0.029,1.072,0.032,1.081,0.118,1.096,0.173,1.13,0.25,0.914,0.25,0.904,0.234,0.858,0.136,0.835,0.064,0.818,-0.011,0.805,-0.133,0.808,-0.251,0.819,-0.325,0.837,-0.397,0.876,-0.502,0.91,-0.568,0.951,-0.631,0.997,-0.691,1.049,-0.747,1.106,-0.798,1.169,-0.845,1.271,-0.905,1.44,-0.974,1.449,-0.988,1.447,-1.027,1.36,-1.56,1.351,-1.591,1.341,-1.597,1.335,-1.596,1.304,-1.576,1.082,-1.392,0.978,-1.3,0.869,-1.195,0.753,-1.075,0.655,-0.965,0.588,-0.88,0.531,-0.798,0.482,-0.718,0.424,-0.602,0.394,-0.528,0.361,-0.421,0.339,-0.32,0.326,-0.225,0.321,-0.136,0.321,-0.033,0.33,0.059,0.347,0.147,0.373,0.232,0.381,0.25,0.13,0.25,0.09,0.158,0.044,0.011,0.022,-0.09,0.008,-0.192,0,-0.348,0.01,-0.522,0.021,-0.607,0.048,-0.731,0.071,-0.812,0.113,-0.932,0.146,-1.01,0.202,-1.125,0.267,-1.238,0.34,-1.348,0.472,-1.521,0.549,-1.609,0.657,-1.724,0.859,-1.919,1.009,-2.052,1.202,-2.216,1.225,-2.245,1.228,-2.273,1.201,-2.461,1.179,-2.686,1.17,-2.855,1.168,-2.998,1.176,-3.161,1.391,-3.161,1.391,-3.16,1.37,-3.055,1.356,-2.944,1.349,-2.826,1.349,-2.667,1.359,-2.502,1.375,-2.38,1.383,-2.359,1.393,-2.35,1.407,-2.352,1.424,-2.364,1.586,-2.512,1.711,-2.636,1.836,-2.774,1.914,-2.874,1.979,-2.972,2.031,-3.067,2.07,-3.161,2.284,-3.161,2.266,-2.996,2.249,-2.908,2.215,-2.776,2.155,-2.602,2.118,-2.517,2.055,-2.391,1.958,-2.228,1.846,-2.074,1.721,-1.93,1.52,-1.728,1.504,-1.707,1.501,-1.689,1.504,-1.66,1.604,-1.08,1.618,-1.027,1.632,-1.015},\n      {1.176,-3.17,1.19,-3.302,1.221,-3.479,1.253,-3.611,1.294,-3.74,1.345,-3.865,1.406,-3.985,1.477,-4.097,1.56,-4.2,1.651,-4.289,1.745,-4.362,1.794,-4.387,1.82,-4.392,1.856,-4.378,1.901,-4.341,1.952,-4.289,2.015,-4.211,2.066,-4.132,2.101,-4.069,2.134,-4.003,2.177,-3.897,2.203,-3.823,2.235,-3.709,2.266,-3.549,2.281,-3.426,2.286,-3.343,2.286,-3.172,2.266,-2.996,2.259,-2.961,1.972,-2.961,1.979,-2.972,2.031,-3.067,2.071,-3.161,2.098,-3.255,2.118,-3.381,2.119,-3.48,2.105,-3.574,2.076,-3.65,2.034,-3.708,1.983,-3.747,1.944,-3.763,1.902,-3.771,1.831,-3.767,1.756,-3.741,1.682,-3.693,1.634,-3.649,1.565,-3.567,1.522,-3.502,1.465,-3.388,1.432,-3.303,1.391,-3.16,1.37,-3.055,1.358,-2.961,1.169,-2.961,1.168,-2.998},\n    },\n  },\n  fClef = {\n    x1 = -0.02, y1 = -1.047, x2 = 2.736, y2 = 2.54,\n    fill = {\n      {2.603,-0.703,2.64,-0.683,2.672,-0.656,2.699,-0.624,2.719,-0.587,2.732,-0.545,2.736,-0.5,2.732,-0.455,2.719,-0.413,2.699,-0.376,2.672,-0.344,2.64,-0.317,2.603,-0.297,2.561,-0.284,2.516,-0.28,2.471,-0.284,2.429,-0.297,2.392,-0.317,2.36,-0.344,2.333,-0.376,2.313,-0.413,2.3,-0.455,2.296,-0.5,2.3,-0.545,2.313,-0.587,2.333,-0.624,2.36,-0.656,2.392,-0.683,2.429,-0.703,2.471,-0.716,2.516,-0.72,2.561,-0.716},\n      {2.606,0.3,2.643,0.32,2.675,0.345,2.7,0.377,2.72,0.414,2.732,0.455,2.736,0.5,2.732,0.545,2.72,0.586,2.7,0.623,2.675,0.654,2.643,0.68,2.606,0.7,2.565,0.712,2.52,0.716,2.475,0.712,2.434,0.7,2.397,0.68,2.365,0.654,2.34,0.623,2.32,0.586,2.308,0.545,2.304,0.5,2.308,0.455,2.32,0.414,2.34,0.377,2.365,0.345,2.397,0.32,2.434,0.3,2.475,0.288,2.52,0.284,2.565,0.288},\n      {1.175,-1.038,1.331,-1.01,1.474,-0.965,1.605,-0.902,1.685,-0.851,1.793,-0.762,1.886,-0.658,1.965,-0.54,2.029,-0.409,2.077,-0.266,2.109,-0.111,2.12,-0.002,2.123,0.161,2.109,0.355,2.086,0.497,2.04,0.682,1.994,0.817,1.939,0.949,1.874,1.076,1.776,1.238,1.692,1.354,1.6,1.464,1.492,1.579,1.375,1.692,1.255,1.798,1.089,1.931,0.918,2.054,0.742,2.169,0.471,2.328,0.194,2.474,0.069,2.533,0.032,2.54,0.009,2.536,-0.013,2.518,-0.02,2.492,-0.012,2.464,0.008,2.44,0.31,2.255,0.478,2.138,0.597,2.048,0.71,1.955,0.816,1.86,0.915,1.763,1.007,1.663,1.09,1.562,1.141,1.493,1.212,1.385,1.258,1.306,1.336,1.142,1.37,1.057,1.413,0.928,1.449,0.796,1.477,0.665,1.498,0.533,1.516,0.359,1.523,0.231,1.523,0.088,1.515,-0.084,1.503,-0.191,1.476,-0.34,1.452,-0.431,1.423,-0.515,1.388,-0.592,1.349,-0.66,1.304,-0.721,1.253,-0.773,1.197,-0.816,1.136,-0.851,1.068,-0.876,0.995,-0.891,0.956,-0.895,0.868,-0.895,0.821,-0.891,0.777,-0.884,0.692,-0.864,0.578,-0.82,0.512,-0.783,0.453,-0.741,0.401,-0.696,0.358,-0.648,0.323,-0.6,0.286,-0.529,0.273,-0.485,0.268,-0.431,0.278,-0.398,0.292,-0.382,0.316,-0.373,0.345,-0.373,0.463,-0.396,0.532,-0.4,0.588,-0.396,0.642,-0.383,0.719,-0.349,0.765,-0.317,0.827,-0.255,0.86,-0.206,0.897,-0.119,0.911,-0.054,0.916,0.016,0.907,0.113,0.89,0.173,0.852,0.253,0.798,0.321,0.755,0.359,0.705,0.39,0.65,0.414,0.59,0.43,0.526,0.439,0.454,0.439,0.382,0.428,0.349,0.42,0.286,0.396,0.257,0.38,0.203,0.344,0.156,0.299,0.115,0.249,0.08,0.192,0.051,0.13,0.029,0.064,0.013,-0.007,0.001,-0.118,0.003,-0.227,0.022,-0.337,0.043,-0.411,0.088,-0.522,0.127,-0.594,0.2,-0.697,0.258,-0.762,0.36,-0.85,0.437,-0.902,0.523,-0.947,0.616,-0.985,0.718,-1.015,0.828,-1.036,0.946,-1.047,1.065,-1.047},\n    },\n  },\n  percClef = {\n    x1 = 0, y1 = -1, x2 = 1.528, y2 = 1,\n    fill = {\n      {1.524,0.963,1.512,0.982,1.494,0.995,1.472,1,0.944,1,0.912,0.989,0.892,0.963,0.888,0.94,0.888,-0.94,0.892,-0.963,0.904,-0.982,0.932,-0.999,1.472,-1,1.504,-0.989,1.524,-0.963,1.528,-0.94,1.528,0.94},\n      {0.631,0.973,0.616,0.989,0.584,1,0.056,1,0.024,0.989,0.004,0.963,0,0.94,0,-0.94,0.004,-0.963,0.016,-0.982,0.044,-0.999,0.584,-1,0.616,-0.989,0.636,-0.963,0.64,-0.94,0.639,0.952},\n    },\n  },\n  brace = {\n    x1 = 0, y1 = -4.002, x2 = 0.276, y2 = 0.003,\n    fill = {\n      {0.073,-2.122,0.114,-2.214,0.139,-2.307,0.148,-2.408,0.142,-2.511,0.126,-2.617,0.044,-2.99,0.018,-3.143,0.008,-3.296,0.012,-3.389,0.019,-3.455,0.036,-3.555,0.053,-3.623,0.085,-3.723,0.112,-3.789,0.16,-3.883,0.198,-3.941,0.24,-3.996,0.245,-4.001,0.259,-4.002,0.274,-3.988,0.272,-3.972,0.244,-3.922,0.21,-3.845,0.192,-3.792,0.171,-3.712,0.155,-3.604,0.148,-3.472,0.153,-3.353,0.168,-3.236,0.243,-2.863,0.267,-2.72,0.275,-2.615,0.272,-2.495,0.261,-2.41,0.249,-2.355,0.213,-2.244,0.174,-2.162,0.143,-2.108,0.064,-2,0.144,-1.89,0.203,-1.78,0.243,-1.669,0.257,-1.614,0.27,-1.529,0.276,-1.416,0.267,-1.277,0.243,-1.134,0.168,-0.761,0.153,-0.644,0.148,-0.524,0.155,-0.394,0.179,-0.259,0.203,-0.179,0.224,-0.126,0.276,-0.024,0.275,-0.008,0.271,-0.003,0.257,0.003,0.244,-0.004,0.182,-0.086,0.146,-0.146,0.115,-0.209,0.088,-0.275,0.055,-0.375,0.038,-0.443,0.019,-0.543,0.012,-0.608,0.008,-0.7,0.018,-0.853,0.044,-1.006,0.126,-1.379,0.142,-1.485,0.148,-1.588,0.139,-1.69,0.114,-1.784,0.073,-1.877,0,-2},\n    },\n  },\n  noteheadWhole = {\n    x1 = 0.001, y1 = -0.499, x2 = 1.687, y2 = 0.5,\n    fill = {\n      {0.944,-0.365,0.924,-0.377,0.861,-0.399,0.828,-0.406,0.76,-0.412,0.648,-0.404,0.604,-0.395,0.562,-0.38,0.507,-0.347,0.476,-0.315,0.464,-0.297,0.441,-0.24,0.433,-0.18,0.435,-0.108,0.448,-0.035,0.482,0.058,0.529,0.144,0.589,0.221,0.645,0.279,0.699,0.322,0.761,0.359,0.827,0.387,0.89,0.404,0.944,0.407,0.944,0.497,0.824,0.5,0.702,0.496,0.591,0.486,0.49,0.469,0.4,0.446,0.32,0.418,0.249,0.384,0.189,0.346,0.137,0.304,0.094,0.259,0.045,0.184,0.014,0.105,0.001,0.021,0.005,-0.065,0.02,-0.121,0.044,-0.174,0.099,-0.249,0.173,-0.316,0.233,-0.356,0.338,-0.408,0.417,-0.437,0.551,-0.471,0.649,-0.487,0.753,-0.497,0.906,-0.499,0.944,-0.496},\n      {1.118,-0.471,1.243,-0.436,1.323,-0.405,1.433,-0.351,1.499,-0.308,1.557,-0.262,1.606,-0.211,1.645,-0.157,1.672,-0.1,1.686,-0.039,1.687,0.022,1.675,0.108,1.657,0.163,1.616,0.24,1.577,0.287,1.502,0.351,1.439,0.388,1.366,0.421,1.282,0.448,1.186,0.47,1.078,0.487,0.958,0.497,0.824,0.5,0.744,0.498,0.744,0.348,0.761,0.359,0.827,0.387,0.89,0.404,0.961,0.408,1.045,0.399,1.112,0.379,1.163,0.35,1.202,0.31,1.222,0.278,1.237,0.241,1.254,0.158,1.255,0.094,1.238,0.001,1.204,-0.092,1.153,-0.18,1.088,-0.259,1.011,-0.326,0.924,-0.377,0.861,-0.399,0.828,-0.406,0.76,-0.412,0.744,-0.411,0.744,-0.496,0.753,-0.497,0.906,-0.499,0.99,-0.492},\n    },\n    outer = {\n      {0.99,-0.492,1.118,-0.471,1.243,-0.436,1.323,-0.405,1.433,-0.351,1.499,-0.308,1.557,-0.262,1.606,-0.211,1.645,-0.157,1.672,-0.1,1.686,-0.039,1.687,0.022,1.675,0.108,1.657,0.163,1.616,0.24,1.577,0.287,1.502,0.351,1.439,0.388,1.366,0.421,1.282,0.448,1.186,0.47,1.078,0.487,0.958,0.497,0.824,0.5,0.702,0.496,0.591,0.486,0.49,0.469,0.4,0.446,0.32,0.418,0.249,0.384,0.189,0.346,0.137,0.304,0.094,0.259,0.045,0.184,0.014,0.105,0.001,0.021,0.005,-0.065,0.02,-0.121,0.044,-0.174,0.099,-0.249,0.173,-0.316,0.233,-0.356,0.338,-0.408,0.417,-0.437,0.551,-0.471,0.649,-0.487,0.753,-0.497,0.906,-0.499},\n    },\n    holes = {\n      {0.441,-0.24,0.464,-0.297,0.476,-0.315,0.507,-0.347,0.562,-0.38,0.604,-0.395,0.648,-0.404,0.76,-0.412,0.828,-0.406,0.861,-0.399,0.924,-0.377,1.011,-0.326,1.088,-0.259,1.153,-0.18,1.204,-0.092,1.238,0.001,1.255,0.094,1.254,0.158,1.237,0.241,1.222,0.278,1.202,0.31,1.163,0.35,1.112,0.379,1.045,0.399,0.961,0.408,0.89,0.404,0.827,0.387,0.761,0.359,0.699,0.322,0.645,0.279,0.589,0.221,0.529,0.144,0.482,0.058,0.448,-0.035,0.435,-0.108,0.433,-0.18},\n    },\n  },\n  noteheadHalf = {\n    x1 = 0, y1 = -0.498, x2 = 1.18, y2 = 0.499,\n    fill = {\n      {0.235,0.478,0.181,0.457,0.133,0.43,0.091,0.396,0.057,0.356,0.03,0.309,0.019,0.284,0.005,0.229,0,0.168,0.003,0.122,0.011,0.069,0.036,-0.017,0.061,-0.077,0.093,-0.139,0.133,-0.2,0.209,-0.287,0.304,-0.365,0.379,-0.41,0.421,-0.43,0.511,-0.463,0.56,-0.476,0.666,-0.494,0.686,-0.495,0.686,-0.285,0.609,-0.25,0.438,-0.155,0.299,-0.064,0.247,-0.023,0.186,0.034,0.157,0.069,0.136,0.102,0.123,0.133,0.116,0.176,0.12,0.207,0.14,0.256,0.165,0.291,0.187,0.311,0.213,0.328,0.243,0.34,0.28,0.347,0.316,0.348,0.368,0.34,0.408,0.33,0.497,0.296,0.602,0.241,0.686,0.187,0.686,0.455,0.632,0.472,0.576,0.484,0.454,0.498,0.355,0.499,0.293,0.492},\n      {0.56,-0.476,0.666,-0.494,0.724,-0.498,0.848,-0.497,0.909,-0.486,0.964,-0.47,1.014,-0.447,1.059,-0.419,1.114,-0.365,1.153,-0.3,1.176,-0.224,1.18,-0.168,1.171,-0.093,1.142,0.014,1.101,0.105,1.043,0.2,0.964,0.291,0.899,0.347,0.822,0.397,0.733,0.439,0.632,0.472,0.576,0.484,0.486,0.494,0.486,0.3,0.497,0.296,0.602,0.241,0.735,0.156,0.844,0.079,0.95,-0.007,1.003,-0.061,1.027,-0.093,1.044,-0.123,1.053,-0.15,1.056,-0.176,1.052,-0.206,1.041,-0.234,1.024,-0.265,1.005,-0.288,0.982,-0.308,0.955,-0.323,0.922,-0.333,0.869,-0.336,0.82,-0.329,0.761,-0.313,0.691,-0.287,0.609,-0.25,0.486,-0.182,0.486,-0.453,0.511,-0.463},\n    },\n    outer = {\n      {0.293,0.492,0.235,0.478,0.181,0.457,0.133,0.43,0.091,0.396,0.057,0.356,0.03,0.309,0.019,0.284,0.005,0.229,0,0.168,0.003,0.122,0.011,0.069,0.036,-0.017,0.061,-0.077,0.093,-0.139,0.133,-0.2,0.209,-0.287,0.304,-0.365,0.379,-0.41,0.421,-0.43,0.511,-0.463,0.56,-0.476,0.666,-0.494,0.724,-0.498,0.848,-0.497,0.909,-0.486,0.964,-0.47,1.014,-0.447,1.059,-0.419,1.114,-0.365,1.153,-0.3,1.176,-0.224,1.18,-0.168,1.171,-0.093,1.142,0.014,1.101,0.105,1.043,0.2,0.964,0.291,0.899,0.347,0.822,0.397,0.733,0.439,0.632,0.472,0.576,0.484,0.454,0.498,0.355,0.499},\n    },\n    holes = {\n      {0.735,0.156,0.602,0.241,0.497,0.296,0.408,0.33,0.368,0.34,0.316,0.348,0.28,0.347,0.243,0.34,0.213,0.328,0.187,0.311,0.165,0.291,0.14,0.256,0.12,0.207,0.116,0.176,0.123,0.133,0.136,0.102,0.157,0.069,0.186,0.034,0.247,-0.023,0.299,-0.064,0.438,-0.155,0.609,-0.25,0.691,-0.287,0.761,-0.313,0.82,-0.329,0.869,-0.336,0.922,-0.333,0.955,-0.323,0.982,-0.308,1.005,-0.288,1.024,-0.265,1.041,-0.234,1.052,-0.206,1.056,-0.176,1.053,-0.15,1.044,-0.123,1.027,-0.093,1.003,-0.061,0.95,-0.007,0.844,0.079},\n    },\n  },\n  noteheadBlack = {\n    x1 = 0, y1 = -0.5, x2 = 1.179, y2 = 0.5,\n    fill = {\n      {0.325,0.496,0.265,0.485,0.209,0.468,0.158,0.443,0.113,0.412,0.074,0.375,0.043,0.331,0.02,0.282,0.005,0.228,0,0.168,0.011,0.062,0.043,-0.04,0.075,-0.106,0.115,-0.168,0.162,-0.227,0.216,-0.282,0.31,-0.355,0.379,-0.397,0.453,-0.432,0.574,-0.473,0.702,-0.495,0.792,-0.5,0.858,-0.496,0.949,-0.477,1.002,-0.455,1.05,-0.427,1.109,-0.373,1.139,-0.33,1.17,-0.254,1.179,-0.198,1.178,-0.132,1.166,-0.06,1.141,0.011,1.085,0.113,1.037,0.177,0.95,0.266,0.884,0.32,0.777,0.389,0.662,0.443,0.583,0.47,0.465,0.495,0.388,0.5},\n    },\n  },\n  noteheadXWhole = {\n    x1 = 0, y1 = -0.5, x2 = 1.508, y2 = 0.5,\n    fill = {\n      {0.449,0.5,0.088,0.5,0.049,0.489,0.028,0.472,0.013,0.45,0.005,0.425,0.005,0.402,0.013,0.372,0.024,0.353,0.368,-0,0.019,-0.36,0.005,-0.385,0,-0.412,0.005,-0.438,0.027,-0.472,0.06,-0.495,0.084,-0.5,0.457,-0.498,0.489,-0.482,0.756,-0.26,0.856,-0.345,0.856,-0.209,0.756,-0.124,0.436,-0.392,0.244,-0.392,0.68,-0,0.244,0.392,0.436,0.392,0.756,0.124,0.856,0.209,0.856,0.347,0.756,0.264,0.474,0.492},\n      {0.856,-0.022,0.856,0.022,0.832,-0},\n      {0.656,0.208,0.756,0.124,1.072,0.392,1.268,0.392,0.832,-0,1.268,-0.392,1.072,-0.392,0.756,-0.124,0.656,-0.208,0.656,-0.343,0.756,-0.26,1.019,-0.482,1.043,-0.496,1.068,-0.5,1.424,-0.5,1.449,-0.495,1.48,-0.472,1.5,-0.438,1.504,-0.412,1.499,-0.381,1.484,-0.353,1.144,-0,1.489,0.36,1.503,0.385,1.508,0.412,1.503,0.438,1.482,0.472,1.448,0.495,1.42,0.5,1.051,0.498,1.019,0.482,0.756,0.264,0.656,0.345},\n      {0.656,0.022,0.656,-0.022,0.68,-0},\n    },\n  },\n  noteheadXHalf = {\n    x1 = 0, y1 = -0.5, x2 = 1.336, y2 = 0.5,\n    fill = {\n      {0.573,0.479,0.54,0.496,0.512,0.5,0.088,0.5,0.048,0.49,0.017,0.464,0.005,0.44,0,0.412,0.004,0.38,0.015,0.358,0.388,-0.06,0.04,-0.344,0.021,-0.373,0.012,-0.412,0.022,-0.45,0.048,-0.482,0.072,-0.495,0.1,-0.5,0.264,-0.5,0.291,-0.496,0.313,-0.482,0.58,-0.272,0.752,-0.472,0.768,-0.485,0.768,-0.229,0.648,-0.092,0.264,-0.412,0.1,-0.412,0.572,-0.012,0.196,0.412,0.408,0.412,0.688,0.096,0.768,0.163,0.768,0.289,0.752,0.276},\n      {0.768,0.007,0.768,0.023,0.76,0.016},\n      {1.32,-0.464,1.332,-0.44,1.336,-0.412,1.333,-0.38,1.327,-0.364,0.948,0.06,1.302,0.355,1.316,0.371,1.327,0.398,1.327,0.421,1.316,0.447,1.287,0.48,1.262,0.495,1.236,0.5,1.068,0.5,1.042,0.494,1.008,0.476,0.752,0.276,0.573,0.479,0.568,0.482,0.568,0.231,0.688,0.096,1.068,0.412,1.236,0.412,0.76,0.016,1.14,-0.412,0.928,-0.412,0.648,-0.092,0.568,-0.159,0.568,-0.281,0.58,-0.272,0.752,-0.472,0.77,-0.486,0.789,-0.495,0.82,-0.5,1.244,-0.5,1.289,-0.49},\n      {0.568,-0.015,0.572,-0.012,0.568,-0.007},\n    },\n  },\n  noteheadXBlack = {\n    x1 = 0.001, y1 = -0.5, x2 = 1.159, y2 = 0.5,\n    fill = {\n      {1.155,0.417,1.159,0.434,1.159,0.453,1.152,0.472,1.139,0.489,1.119,0.499,1.103,0.5,1.091,0.496,0.576,0.068,0.075,0.492,0.052,0.5,0.041,0.499,0.021,0.489,0.008,0.473,0.001,0.452,0.002,0.424,0.013,0.402,0.496,-0,0.02,-0.4,0.009,-0.414,0.001,-0.44,0.004,-0.466,0.013,-0.483,0.038,-0.499,0.055,-0.5,0.08,-0.492,0.576,-0.072,1.08,-0.492,1.108,-0.5,1.135,-0.491,1.15,-0.476,1.159,-0.456,1.157,-0.427,1.146,-0.405,0.664,-0,1.14,0.396},\n    },\n  },\n  flag8thUp = {\n    x1 = 0, y1 = -0.036, x2 = 1.055, y2 = 3.24,\n    fill = {\n      {0.939,3.19,0.91,3.221,0.879,3.237,0.849,3.24,0.824,3.224,0.799,3.196,0.785,3.17,0.777,3.138,0.78,3.089,0.826,2.945,0.859,2.801,0.875,2.684,0.884,2.54,0.877,2.338,0.859,2.175,0.828,2.03,0.788,1.912,0.716,1.762,0.622,1.599,0.513,1.435,0.393,1.281,0.269,1.147,0.176,1.067,0.085,1.01,0.028,0.987,0,0.98,0,0.024,0.001,0.009,0.01,-0.013,0.037,-0.031,0.076,-0.036,0.099,-0.033,0.129,-0.016,0.144,0.005,0.156,0.034,0.185,0.179,0.23,0.343,0.27,0.463,0.334,0.619,0.388,0.733,0.466,0.881,0.668,1.214,0.779,1.419,0.84,1.547,0.895,1.678,0.944,1.812,0.972,1.902,1.017,2.087,1.04,2.228,1.053,2.372,1.055,2.511,1.047,2.642,1.025,2.814,0.99,3,0.952,3.16},\n    },\n  },\n  flag8thDown = {\n    x1 = 0, y1 = -3.231, x2 = 1.223, y2 = 0.055,\n    fill = {\n      {0.949,-3.09,0.949,-3.126,0.957,-3.159,0.971,-3.187,0.99,-3.208,1.024,-3.228,1.057,-3.231,1.082,-3.221,1.102,-3.197,1.112,-3.172,1.173,-2.913,1.204,-2.733,1.222,-2.532,1.223,-2.4,1.212,-2.256,1.189,-2.114,1.142,-1.927,1.096,-1.79,1.043,-1.656,0.983,-1.525,0.895,-1.356,0.825,-1.233,0.728,-1.076,0.416,-0.615,0.348,-0.503,0.286,-0.389,0.232,-0.272,0.202,-0.193,0.178,-0.113,0.15,0.002,0.133,0.027,0.111,0.043,0.075,0.055,0.043,0.053,0.024,0.044,0.009,0.029,0,-0.004,0,-0.944,0.156,-1.004,0.292,-1.073,0.41,-1.149,0.513,-1.232,0.601,-1.321,0.701,-1.446,0.783,-1.578,0.868,-1.749,0.929,-1.904,0.987,-2.1,1.025,-2.283,1.042,-2.425,1.042,-2.579,1.029,-2.726,0.998,-2.902},\n    },\n  },\n  flag16thUp = {\n    x1 = 0, y1 = -0.008, x2 = 1.116, y2 = 3.252,\n    fill = {\n      {1.045,3.241,1.027,3.249,1.001,3.252,0.967,3.24,0.949,3.228,0.934,3.208,0.924,3.182,0.92,3.135,0.946,2.944,0.956,2.779,0.952,2.633,0.932,2.482,0.896,2.334,0.854,2.218,0.797,2.1,0.705,1.946,0.643,1.862,0.551,1.764,0.49,1.713,0.398,1.657,0.308,1.621,0.219,1.6,0.132,1.589,0,1.584,0,1.26,0.337,1.26,0.364,1.294,0.571,1.506,0.669,1.616,0.757,1.723,0.841,1.842,0.857,1.851,0.882,1.849,0.907,1.838,0.922,1.817,0.933,1.782,0.944,1.724,0.948,1.62,0.937,1.526,0.914,1.435,0.877,1.349,0.822,1.262,0.82,1.26,1.035,1.26,1.054,1.308,1.077,1.395,1.094,1.502,1.1,1.589,1.097,1.681,1.085,1.792,1.065,1.894,1.036,2.008,0.998,2.119,0.996,2.14,1,2.176,1.044,2.277,1.078,2.382,1.102,2.49,1.112,2.572,1.116,2.778,1.109,3.014,1.096,3.155,1.091,3.178,1.063,3.225},\n      {0.007,0.014,0.036,-0.003,0.068,-0.008,0.098,-0.004,0.119,0.004,0.137,0.02,0.148,0.044,0.167,0.139,0.192,0.222,0.222,0.294,0.274,0.387,0.314,0.44,0.38,0.51,0.63,0.737,0.864,0.995,0.929,1.076,0.981,1.152,1.022,1.228,1.054,1.308,1.077,1.395,1.087,1.46,0.92,1.46,0.914,1.435,0.877,1.349,0.822,1.262,0.743,1.159,0.65,1.06,0.573,0.994,0.49,0.939,0.403,0.897,0.311,0.873,0.216,0.868,0.194,0.872,0.176,0.882,0.164,0.895,0.16,0.912,0.188,1.001,0.232,1.105,0.284,1.193,0.364,1.294,0.526,1.46,0,1.46,0,0.032},\n    },\n  },\n  flag16thDown = {\n    x1 = 0, y1 = -3.248, x2 = 1.163, y2 = 0.036,\n    fill = {\n      {1.072,-1.238,1.029,-1.152,0.977,-1.071,0.917,-0.995,0.853,-0.923,0.783,-0.853,0.458,-0.552,0.359,-0.446,0.299,-0.371,0.247,-0.291,0.204,-0.206,0.17,-0.115,0.148,-0.016,0.138,0.008,0.121,0.024,0.099,0.032,0.068,0.036,0.041,0.033,0.011,0.017,0,-0.004,0,-1.432,0.565,-1.432,0.564,-1.431,0.373,-1.252,0.288,-1.155,0.233,-1.07,0.188,-0.969,0.16,-0.884,0.164,-0.865,0.176,-0.853,0.194,-0.843,0.216,-0.84,0.312,-0.845,0.407,-0.869,0.501,-0.911,0.591,-0.966,0.703,-1.056,0.778,-1.131,0.862,-1.234,0.905,-1.3,0.946,-1.384,0.96,-1.432,1.128,-1.432,1.106,-1.331},\n      {0.975,-3.224,0.993,-3.238,1.028,-3.248,1.063,-3.247,1.082,-3.241,1.098,-3.227,1.112,-3.201,1.124,-3.16,1.144,-3.041,1.158,-2.916,1.163,-2.815,1.163,-2.699,1.157,-2.603,1.146,-2.507,1.129,-2.413,1.106,-2.321,1.076,-2.233,1.04,-2.148,1.036,-2.112,1.038,-2.089,1.069,-2.003,1.098,-1.898,1.119,-1.799,1.134,-1.69,1.14,-1.576,1.137,-1.501,1.128,-1.432,1.106,-1.331,1.072,-1.238,1.069,-1.232,0.86,-1.232,0.862,-1.234,0.905,-1.3,0.946,-1.384,0.973,-1.473,0.986,-1.567,0.986,-1.675,0.967,-1.776,0.953,-1.803,0.94,-1.814,0.922,-1.821,0.897,-1.823,0.881,-1.814,0.783,-1.674,0.636,-1.505,0.564,-1.431,0.373,-1.252,0.355,-1.232,0,-1.232,0,-1.552,0.159,-1.56,0.279,-1.579,0.371,-1.607,0.465,-1.652,0.56,-1.717,0.654,-1.806,0.747,-1.924,0.808,-2.02,0.868,-2.132,0.917,-2.249,0.953,-2.371,0.982,-2.526,0.995,-2.684,0.995,-2.823,0.982,-2.997,0.958,-3.162,0.963,-3.204},\n    },\n  },\n  flag32ndUp = {\n    x1 = 0, y1 = -0.596, x2 = 1.044, y2 = 3.248,\n    fill = {\n      {1.032,3.075,1.021,3.168,1.016,3.184,1.007,3.198,0.979,3.229,0.953,3.245,0.931,3.248,0.903,3.235,0.886,3.22,0.867,3.188,0.861,3.16,0.86,3.139,0.886,2.956,0.895,2.821,0.893,2.686,0.876,2.539,0.849,2.425,0.821,2.34,0.772,2.228,0.713,2.117,0.653,2.022,0.564,1.909,0.505,1.851,0.416,1.785,0.329,1.741,0.242,1.714,0.129,1.698,0,1.692,0,1.38,0.313,1.38,0.357,1.432,0.6,1.688,0.708,1.819,0.792,1.935,0.805,1.939,0.822,1.939,0.84,1.933,0.853,1.922,0.863,1.894,0.876,1.824,0.883,1.752,0.882,1.682,0.872,1.615,0.854,1.55,0.829,1.487,0.796,1.427,0.764,1.38,0.96,1.38,0.983,1.438,1.012,1.551,1.026,1.656,1.027,1.75,1.017,1.861,0.999,1.964,0.97,2.079,0.934,2.194,0.932,2.219,0.934,2.235,0.98,2.362,1.008,2.462,1.031,2.589,1.044,2.804,1.041,2.933},\n      {0.302,0.616,0.377,0.701,0.588,0.902,0.743,1.071,0.832,1.176,0.878,1.012,0.892,0.916,0.889,0.875,0.878,0.831,0.86,0.78,0.832,0.724,0.777,0.637,0.761,0.616,0.961,0.616,0.988,0.687,1.02,0.828,1.024,0.89,1.022,0.971,1.014,1.054,0.995,1.16,0.97,1.258,0.944,1.34,0.983,1.438,1.012,1.551,1.016,1.58,0.863,1.58,0.854,1.55,0.829,1.487,0.796,1.427,0.748,1.357,0.687,1.282,0.619,1.21,0.568,1.166,0.487,1.107,0.429,1.075,0.337,1.039,0.272,1.025,0.204,1.02,0.174,1.03,0.157,1.055,0.156,1.084,0.196,1.193,0.227,1.255,0.261,1.311,0.298,1.362,0.357,1.432,0.497,1.58,0,1.58,0,0.616},\n      {0.001,-0.558,0.011,-0.575,0.037,-0.592,0.056,-0.596,0.081,-0.591,0.101,-0.576,0.116,-0.556,0.126,-0.532,0.159,-0.39,0.185,-0.316,0.216,-0.252,0.27,-0.17,0.353,-0.078,0.588,0.135,0.788,0.357,0.872,0.463,0.921,0.537,0.959,0.61,0.988,0.687,1.017,0.816,0.873,0.816,0.86,0.78,0.832,0.724,0.777,0.637,0.693,0.526,0.608,0.437,0.522,0.369,0.437,0.319,0.352,0.285,0.267,0.265,0.156,0.256,0.175,0.347,0.212,0.461,0.242,0.525,0.295,0.608,0.377,0.701,0.497,0.816,0,0.816,0,-0.548},\n    },\n  },\n  flag32ndDown = {\n    x1 = 0, y1 = -3.246, x2 = 1.092, y2 = 0.688,\n    fill = {\n      {1.028,-0.65,0.998,-0.569,0.958,-0.492,0.908,-0.415,0.844,-0.334,0.611,-0.073,0.535,-0.001,0.365,0.15,0.279,0.245,0.223,0.33,0.191,0.397,0.163,0.473,0.13,0.619,0.121,0.641,0.099,0.67,0.079,0.683,0.056,0.688,0.034,0.685,0.009,0.668,0,0.636,0,-0.788,0.5,-0.788,0.375,-0.67,0.294,-0.575,0.242,-0.49,0.199,-0.387,0.165,-0.26,0.156,-0.212,0.159,-0.203,0.164,-0.2,0.191,-0.201,0.275,-0.209,0.359,-0.228,0.415,-0.249,0.5,-0.291,0.556,-0.329,0.613,-0.374,0.669,-0.427,0.726,-0.49,0.781,-0.562,0.864,-0.688,0.894,-0.747,0.909,-0.788,1.059,-0.788,1.043,-0.708},\n      {1.016,-1.431,0.976,-1.344,1.008,-1.24,1.034,-1.14,1.053,-1.031,1.062,-0.945,1.064,-0.861,1.06,-0.797,1.043,-0.708,1.028,-0.65,1.005,-0.588,0.799,-0.588,0.864,-0.688,0.894,-0.747,0.914,-0.8,0.927,-0.861,0.927,-0.911,0.916,-0.972,0.86,-1.176,0.77,-1.068,0.611,-0.893,0.375,-0.67,0.305,-0.588,0,-0.588,0,-1.598,0.517,-1.598,0.375,-1.457,0.314,-1.387,0.258,-1.31,0.224,-1.251,0.18,-1.15,0.156,-1.072,0.163,-1.047,0.176,-1.031,0.195,-1.021,0.208,-1.02,0.26,-1.021,0.323,-1.03,0.414,-1.059,0.499,-1.103,0.579,-1.16,0.653,-1.226,0.74,-1.323,0.795,-1.399,0.847,-1.482,0.884,-1.563,0.895,-1.598,1.055,-1.598,1.048,-1.549},\n      {1.036,-2.325,0.98,-2.219,0.976,-2.204,1.018,-2.081,1.043,-1.98,1.059,-1.888,1.067,-1.784,1.065,-1.67,1.048,-1.549,1.016,-1.431,1,-1.398,0.795,-1.398,0.795,-1.399,0.847,-1.482,0.884,-1.563,0.904,-1.627,0.918,-1.715,0.919,-1.785,0.912,-1.86,0.901,-1.919,0.892,-1.952,0.884,-1.962,0.862,-1.973,0.844,-1.976,0.83,-1.974,0.817,-1.966,0.721,-1.832,0.604,-1.692,0.534,-1.615,0.375,-1.457,0.323,-1.398,0,-1.398,0,-1.72,0.137,-1.728,0.249,-1.748,0.336,-1.778,0.424,-1.825,0.515,-1.895,0.608,-1.991,0.704,-2.118,0.77,-2.222,0.834,-2.336,0.87,-2.413,0.904,-2.507,0.922,-2.592,0.928,-2.672,0.921,-2.767,0.844,-3.14,0.847,-3.17,0.862,-3.207,0.883,-3.234,0.906,-3.246,0.943,-3.245,0.971,-3.23,0.999,-3.199,1.02,-3.153,1.056,-3.009,1.079,-2.877,1.09,-2.772,1.092,-2.66,1.08,-2.511,1.059,-2.392},\n    },\n  },\n  flag64thUp = {\n    x1 = 0, y1 = -1.387, x2 = 1.044, y2 = 3.248,\n    fill = {\n      {1.032,3.075,1.021,3.168,1.016,3.184,1.007,3.198,0.979,3.229,0.953,3.245,0.931,3.248,0.903,3.235,0.886,3.22,0.867,3.188,0.861,3.16,0.86,3.139,0.886,2.956,0.895,2.821,0.893,2.686,0.876,2.539,0.849,2.425,0.821,2.34,0.772,2.228,0.713,2.117,0.653,2.022,0.564,1.909,0.505,1.851,0.416,1.785,0.329,1.741,0.242,1.714,0.129,1.698,0,1.692,0,1.38,0.309,1.38,0.341,1.42,0.513,1.594,0.6,1.688,0.708,1.819,0.792,1.935,0.805,1.939,0.822,1.939,0.84,1.933,0.853,1.922,0.863,1.894,0.876,1.824,0.883,1.752,0.882,1.682,0.872,1.615,0.847,1.529,0.819,1.467,0.784,1.408,0.764,1.38,0.96,1.38,0.983,1.438,1.012,1.551,1.026,1.656,1.027,1.75,1.017,1.861,0.999,1.964,0.97,2.079,0.934,2.194,0.932,2.219,0.934,2.235,0.98,2.362,1.008,2.462,1.031,2.589,1.044,2.804,1.041,2.933},\n      {0.302,0.616,0.377,0.701,0.588,0.902,0.743,1.071,0.832,1.176,0.878,1.012,0.892,0.916,0.889,0.875,0.878,0.831,0.842,0.744,0.777,0.637,0.761,0.616,0.96,0.616,0.976,0.65,1.004,0.743,1.022,0.84,1.024,0.944,1.017,1.027,1,1.134,0.977,1.234,0.944,1.34,0.983,1.438,1.012,1.551,1.016,1.58,0.862,1.58,0.847,1.529,0.819,1.467,0.784,1.408,0.729,1.332,0.665,1.258,0.594,1.187,0.542,1.145,0.458,1.09,0.399,1.061,0.304,1.031,0.238,1.021,0.193,1.021,0.165,1.036,0.153,1.052,0.151,1.062,0.175,1.147,0.217,1.245,0.266,1.327,0.341,1.42,0.5,1.58,0,1.58,0,0.616},\n      {1.003,-0.049,1.016,0.012,1.023,0.084,1.02,0.209,1.008,0.297,0.99,0.381,0.963,0.482,0.936,0.564,0.976,0.65,1.004,0.743,1.017,0.816,0.872,0.816,0.842,0.744,0.777,0.637,0.693,0.526,0.608,0.437,0.522,0.369,0.437,0.319,0.352,0.285,0.267,0.265,0.156,0.256,0.175,0.347,0.212,0.461,0.242,0.525,0.295,0.608,0.377,0.701,0.497,0.816,0,0.816,0,-0.166,0.294,-0.166,0.298,-0.16,0.378,-0.066,0.612,0.16,0.828,0.404,0.88,0.208,0.892,0.136,0.891,0.097,0.883,0.054,0.867,0.006,0.842,-0.048,0.777,-0.155,0.768,-0.166,0.964,-0.166,0.979,-0.131},\n      {0.026,-1.38,0.046,-1.387,0.067,-1.387,0.088,-1.376,0.107,-1.359,0.121,-1.336,0.147,-1.222,0.171,-1.144,0.2,-1.075,0.251,-0.988,0.29,-0.938,0.353,-0.87,0.588,-0.657,0.737,-0.495,0.833,-0.381,0.906,-0.28,0.947,-0.207,0.979,-0.131,1.003,-0.049,1.016,0.012,1.018,0.034,0.876,0.034,0.867,0.006,0.842,-0.048,0.777,-0.155,0.694,-0.265,0.61,-0.353,0.525,-0.421,0.44,-0.472,0.355,-0.506,0.27,-0.527,0.156,-0.536,0.179,-0.427,0.217,-0.309,0.247,-0.244,0.298,-0.16,0.378,-0.066,0.481,0.034,0,0.034,0,-1.34,0.01,-1.367},\n    },\n  },\n  flag64thDown = {\n    x1 = 0, y1 = -3.246, x2 = 1.092, y2 = 1.503,\n    fill = {\n      {1.036,0.138,1.009,0.221,0.973,0.299,0.926,0.375,0.844,0.482,0.611,0.743,0.535,0.815,0.365,0.966,0.299,1.035,0.259,1.088,0.206,1.178,0.176,1.249,0.151,1.331,0.13,1.435,0.121,1.457,0.107,1.478,0.089,1.494,0.068,1.503,0.044,1.503,0.016,1.488,0.004,1.472,0,1.452,0,0.03,0.505,0.03,0.382,0.153,0.299,0.248,0.247,0.329,0.204,0.421,0.171,0.531,0.156,0.616,0.238,0.611,0.294,0.602,0.379,0.578,0.436,0.555,0.494,0.525,0.552,0.487,0.61,0.442,0.667,0.389,0.724,0.326,0.781,0.254,0.864,0.128,0.894,0.069,0.909,0.03,1.059,0.03,1.059,0.031},\n      {1.016,-0.613,0.976,-0.524,1.004,-0.445,1.031,-0.35,1.053,-0.244,1.064,-0.16,1.068,-0.076,1.066,-0.023,1.059,0.031,1.036,0.138,1.009,0.221,1.004,0.23,0.797,0.23,0.864,0.128,0.894,0.069,0.914,0.016,0.927,-0.045,0.927,-0.095,0.916,-0.156,0.864,-0.356,0.636,-0.1,0.382,0.153,0.315,0.23,0,0.23,0,-0.788,0.5,-0.788,0.375,-0.67,0.294,-0.575,0.242,-0.49,0.199,-0.387,0.165,-0.26,0.156,-0.212,0.159,-0.203,0.164,-0.2,0.191,-0.201,0.275,-0.209,0.359,-0.228,0.415,-0.249,0.5,-0.291,0.556,-0.329,0.613,-0.374,0.669,-0.427,0.726,-0.49,0.781,-0.562,0.864,-0.688,0.894,-0.747,0.909,-0.788,1.058,-0.788,1.044,-0.708},\n      {1.016,-1.431,0.976,-1.344,1.015,-1.216,1.039,-1.113,1.057,-1.002,1.064,-0.917,1.062,-0.809,1.044,-0.708,1.016,-0.613,1.004,-0.588,0.799,-0.588,0.864,-0.688,0.894,-0.747,0.914,-0.8,0.927,-0.861,0.927,-0.911,0.918,-0.962,0.86,-1.176,0.77,-1.068,0.611,-0.893,0.375,-0.67,0.305,-0.588,0,-0.588,0,-1.598,0.517,-1.598,0.334,-1.411,0.276,-1.337,0.24,-1.281,0.194,-1.186,0.156,-1.072,0.159,-1.055,0.176,-1.031,0.195,-1.021,0.228,-1.02,0.292,-1.025,0.384,-1.048,0.472,-1.087,0.553,-1.14,0.629,-1.203,0.719,-1.298,0.795,-1.399,0.847,-1.482,0.884,-1.563,0.895,-1.598,1.055,-1.598,1.048,-1.549},\n      {0.98,-2.219,0.976,-2.204,1.018,-2.081,1.043,-1.98,1.059,-1.888,1.067,-1.784,1.065,-1.67,1.048,-1.549,1.016,-1.431,1,-1.398,0.795,-1.398,0.795,-1.399,0.847,-1.482,0.884,-1.563,0.904,-1.627,0.918,-1.715,0.919,-1.785,0.912,-1.86,0.901,-1.919,0.892,-1.952,0.884,-1.962,0.862,-1.973,0.844,-1.976,0.83,-1.974,0.817,-1.966,0.721,-1.832,0.604,-1.692,0.534,-1.615,0.334,-1.411,0.324,-1.398,0,-1.398,0,-1.72,0.137,-1.728,0.249,-1.748,0.336,-1.778,0.424,-1.825,0.515,-1.895,0.608,-1.991,0.704,-2.118,0.77,-2.222,0.834,-2.336,0.87,-2.413,0.904,-2.507,0.922,-2.592,0.928,-2.672,0.921,-2.767,0.844,-3.14,0.847,-3.17,0.862,-3.207,0.883,-3.234,0.906,-3.246,0.943,-3.245,0.971,-3.23,0.999,-3.199,1.02,-3.153,1.056,-3.009,1.079,-2.877,1.09,-2.772,1.092,-2.66,1.08,-2.511,1.059,-2.392,1.036,-2.325},\n    },\n  },\n  accidentalFlat = {\n    x1 = 0, y1 = -1.756, x2 = 0.903, y2 = 0.7,\n    fill = {\n      {0.02,-0.021,0.019,-0.108,0.177,-0.108,0.176,-0.076,0.188,0.332,0.192,0.352,0.202,0.37,0.22,0.382,0.232,0.384,0.272,0.372,0.335,0.327,0.414,0.258,0.484,0.182,0.539,0.107,0.58,0.033,0.603,-0.024,0.619,-0.08,0.622,-0.108,0.887,-0.108,0.887,-0.106,0.87,-0.053,0.846,0.001,0.815,0.057,0.778,0.115,0.732,0.174,0.679,0.233,0.617,0.294,0.547,0.355,0.387,0.475,0.234,0.603,0.152,0.665,0.103,0.695,0.084,0.7,0.06,0.692,0.046,0.673,0.032,0.468},\n      {0,-1.644,0.013,-1.692,0.043,-1.727,0.082,-1.749,0.124,-1.756,0.161,-1.748,0.181,-1.734,0.195,-1.714,0.2,-1.688,0.172,-0.56,0.179,-0.529,0.19,-0.511,0.206,-0.497,0.226,-0.488,0.243,-0.489,0.273,-0.505,0.324,-0.544,0.364,-0.566,0.433,-0.592,0.512,-0.61,0.544,-0.612,0.599,-0.604,0.678,-0.579,0.727,-0.553,0.772,-0.52,0.812,-0.48,0.847,-0.434,0.874,-0.383,0.893,-0.325,0.903,-0.262,0.903,-0.205,0.898,-0.156,0.887,-0.106,0.87,-0.053,0.846,0.001,0.815,0.057,0.793,0.092,0.547,0.092,0.58,0.033,0.603,-0.024,0.619,-0.08,0.628,-0.151,0.626,-0.205,0.616,-0.258,0.591,-0.319,0.556,-0.365,0.526,-0.386,0.49,-0.398,0.453,-0.4,0.408,-0.392,0.372,-0.378,0.331,-0.354,0.265,-0.301,0.22,-0.257,0.189,-0.216,0.18,-0.178,0.176,-0.076,0.181,0.092,0.023,0.092,0.02,-0.021},\n    },\n  },\n  accidentalNatural = {\n    x1 = 0, y1 = -1.363, x2 = 0.672, y2 = 1.34,\n    fill = {\n      {0.663,1.319,0.642,1.336,0.624,1.34,0.572,1.34,0.553,1.336,0.537,1.327,0.528,1.311,0.524,1.292,0.524,0.696,0.515,0.67,0.501,0.66,0.481,0.654,0.456,0.652,0.411,0.656,0.333,0.673,0.249,0.698,0.055,0.775,0.032,0.78,0.017,0.777,0.006,0.768,0.001,0.754,0,-0.118,0.148,-0.118,0.148,0.256,0.158,0.272,0.196,0.28,0.236,0.276,0.308,0.259,0.385,0.231,0.433,0.207,0.491,0.169,0.515,0.142,0.524,0.116,0.524,-0.118,0.672,-0.118,0.672,1.292},\n      {0.655,-0.744,0.667,-0.733,0.672,-0.716,0.672,0.082,0.524,0.082,0.524,-0.296,0.523,-0.303,0.515,-0.312,0.488,-0.316,0.449,-0.312,0.348,-0.284,0.269,-0.251,0.222,-0.227,0.183,-0.202,0.157,-0.178,0.148,-0.156,0.148,0.082,0,0.082,0,-1.316,0.004,-1.335,0.013,-1.351,0.038,-1.363,0.109,-1.363,0.133,-1.351,0.147,-1.326,0.148,-0.648,0.153,-0.636,0.177,-0.628,0.209,-0.629,0.288,-0.642,0.407,-0.674,0.64,-0.748},\n    },\n  },\n  accidentalSharp = {\n    x1 = 0, y1 = -1.399, x2 = 0.996, y2 = 1.391,\n    fill = {\n      {0.806,0.106,0.82,0.12,0.836,0.127,0.844,0.128,0.958,0.085,0.976,0.085,0.992,0.099,0.996,0.116,0.996,0.4,0.988,0.429,0.967,0.456,0.948,0.468,0.827,0.517,0.812,0.534,0.797,0.569,0.792,0.604,0.791,1.181,0.782,1.196,0.765,1.208,0.724,1.216,0.695,1.208,0.681,1.196,0.673,1.181,0.671,0.663,0.661,0.632,0.648,0.613,0.63,0.602,0.62,0.6,0.604,0.604,0.36,0.704,0.341,0.719,0.33,0.737,0.323,0.761,0.32,0.792,0.319,1.357,0.309,1.372,0.291,1.384,0.266,1.391,0.232,1.389,0.209,1.372,0.2,1.348,0.2,0.856,0.196,0.838,0.179,0.807,0.162,0.794,0.144,0.793,0.032,0.836,0.017,0.833,0.006,0.824,0,0.8,0,0.516,0.004,0.497,0.021,0.469,0.038,0.456,0.164,0.403,0.178,0.389,0.19,0.369,0.199,0.33,0.2,-0.08,0.198,-0.094,0.313,-0.094,0.31,-0.013,0.308,0.167,0.313,0.282,0.323,0.325,0.349,0.338,0.386,0.339,0.451,0.326,0.522,0.301,0.59,0.266,0.627,0.239,0.656,0.21,0.666,0.195,0.674,0.17,0.685,0.046,0.688,-0.094,0.793,-0.094,0.793,0.071},\n      {0.812,-0.394,0.801,-0.365,0.793,-0.326,0.793,0.071,0.806,0.106,0.68,0.106,0.685,0.046,0.688,-0.103,0.681,-0.243,0.674,-0.297,0.668,-0.31,0.654,-0.32,0.624,-0.328,0.592,-0.327,0.549,-0.32,0.454,-0.288,0.41,-0.266,0.371,-0.241,0.331,-0.202,0.32,-0.176,0.315,-0.142,0.31,-0.013,0.309,0.106,0.2,0.106,0.2,-0.08,0.197,-0.102,0.188,-0.123,0.174,-0.14,0.148,-0.152,0.036,-0.105,0.017,-0.107,0.006,-0.116,0,-0.14,0,-0.424,0.008,-0.453,0.029,-0.478,0.16,-0.537,0.182,-0.564,0.193,-0.59,0.2,-0.64,0.2,-1.18,0.204,-1.197,0.217,-1.211,0.237,-1.22,0.274,-1.223,0.302,-1.211,0.319,-1.189,0.322,-0.677,0.333,-0.643,0.347,-0.626,0.368,-0.62,0.401,-0.629,0.501,-0.665,0.608,-0.714,0.63,-0.728,0.653,-0.76,0.666,-0.798,0.672,-0.836,0.673,-1.365,0.689,-1.387,0.722,-1.399,0.758,-1.397,0.783,-1.38,0.792,-1.356,0.792,-0.868,0.797,-0.846,0.818,-0.824,0.848,-0.816,0.953,-0.854,0.968,-0.856,0.988,-0.848,0.996,-0.824,0.996,-0.54,0.992,-0.521,0.975,-0.492,0.958,-0.477,0.844,-0.432,0.826,-0.418},\n      {0.976,0.085,0.992,0.099,0.994,0.106,0.902,0.106,0.958,0.085},\n    },\n  },\n  accidentalDoubleSharp = {\n    x1 = 0, y1 = -0.508, x2 = 0.988, y2 = 0.5,\n    fill = {\n      {0.837,0.129,0.906,0.136,0.944,0.146,0.964,0.163,0.975,0.196,0.985,0.261,0.986,0.372,0.978,0.419,0.971,0.443,0.96,0.46,0.931,0.479,0.905,0.489,0.859,0.497,0.771,0.498,0.691,0.483,0.648,0.46,0.64,0.448,0.633,0.414,0.628,0.308,0.609,0.26,0.579,0.204,0.543,0.155,0.517,0.132,0.492,0.124,0.468,0.131,0.446,0.151,0.425,0.179,0.396,0.229,0.361,0.304,0.356,0.377,0.348,0.422,0.34,0.445,0.32,0.467,0.3,0.479,0.26,0.492,0.213,0.499,0.162,0.5,0.077,0.487,0.039,0.472,0.02,0.46,0.013,0.448,0.005,0.408,0,0.308,0.005,0.209,0.013,0.17,0.02,0.156,0.038,0.146,0.08,0.136,0.153,0.129,0.232,0.128,0.246,0.123,0.317,0.089,0.371,0.054,0.408,0.017,0.416,-0.008,0.407,-0.024,0.366,-0.057,0.228,-0.14,0.188,-0.136,0.115,-0.142,0.052,-0.158,0.02,-0.176,0.014,-0.188,0.006,-0.224,0,-0.312,0.004,-0.413,0.017,-0.476,0.038,-0.49,0.063,-0.497,0.165,-0.508,0.258,-0.504,0.302,-0.495,0.322,-0.486,0.338,-0.466,0.346,-0.443,0.355,-0.397,0.36,-0.324,0.387,-0.257,0.419,-0.2,0.444,-0.167,0.47,-0.145,0.496,-0.136,0.519,-0.145,0.555,-0.186,0.589,-0.243,0.623,-0.312,0.628,-0.324,0.635,-0.446,0.644,-0.475,0.655,-0.485,0.675,-0.494,0.719,-0.503,0.812,-0.508,0.905,-0.501,0.934,-0.495,0.954,-0.486,0.964,-0.473,0.975,-0.44,0.988,-0.339,0.987,-0.282,0.982,-0.232,0.971,-0.193,0.96,-0.176,0.931,-0.158,0.875,-0.142,0.808,-0.136,0.76,-0.14,0.73,-0.128,0.673,-0.102,0.619,-0.068,0.591,-0.043,0.574,-0.017,0.574,0.003,0.606,0.033,0.679,0.082,0.76,0.128},\n    },\n  },\n  accidentalDoubleFlat = {\n    x1 = 0.001, y1 = -1.747, x2 = 1.644, y2 = 0.7,\n    fill = {\n      {1.597,-0.026,1.553,0.058,1.515,0.116,1.469,0.175,1.414,0.235,1.352,0.296,1.28,0.358,1.121,0.478,0.953,0.621,0.867,0.679,0.834,0.697,0.816,0.7,0.8,0.692,0.788,0.68,0.781,0.645,0.77,0.47,0.76,0.14,0.684,0.227,0.589,0.319,0.499,0.393,0.389,0.475,0.218,0.621,0.153,0.666,0.098,0.697,0.072,0.698,0.054,0.687,0.046,0.673,0.04,0.603,0.026,0.214,0.021,-0.108,0.177,-0.108,0.176,-0.093,0.181,0.152,0.189,0.33,0.193,0.351,0.204,0.37,0.221,0.382,0.232,0.384,0.252,0.38,0.29,0.357,0.356,0.309,0.416,0.256,0.471,0.2,0.517,0.143,0.564,0.072,0.604,-0.021,0.624,-0.108,0.912,-0.108,0.912,-0.05,0.924,0.309,0.926,0.34,0.94,0.37,0.957,0.382,0.968,0.384,0.995,0.376,1.049,0.342,1.112,0.292,1.171,0.237,1.222,0.181,1.265,0.125,1.296,0.072,1.336,-0.023,1.356,-0.108,1.626,-0.108,1.618,-0.08},\n      {1.41,-0.578,1.481,-0.54,1.523,-0.508,1.576,-0.447,1.605,-0.4,1.626,-0.347,1.639,-0.29,1.644,-0.228,1.638,-0.156,1.618,-0.08,1.597,-0.026,1.553,0.058,1.531,0.092,1.284,0.092,1.296,0.072,1.336,-0.023,1.357,-0.113,1.36,-0.164,1.358,-0.203,1.352,-0.24,1.338,-0.29,1.325,-0.32,1.3,-0.36,1.263,-0.388,1.241,-0.396,1.204,-0.4,1.171,-0.397,1.136,-0.388,1.069,-0.354,1,-0.301,0.94,-0.241,0.916,-0.2,0.912,-0.166,0.912,-0.05,0.917,0.092,0.551,0.092,0.564,0.072,0.604,-0.021,0.625,-0.112,0.628,-0.164,0.626,-0.203,0.611,-0.274,0.583,-0.334,0.564,-0.36,0.537,-0.383,0.517,-0.393,0.481,-0.4,0.435,-0.397,0.4,-0.388,0.35,-0.364,0.267,-0.301,0.208,-0.241,0.184,-0.2,0.176,-0.093,0.18,0.092,0.024,0.092,0.013,-0.54,0.001,-1.577,0.002,-1.66,0.013,-1.689,0.031,-1.712,0.055,-1.73,0.082,-1.741,0.11,-1.747,0.137,-1.747,0.161,-1.741,0.181,-1.729,0.195,-1.71,0.199,-1.698,0.172,-0.56,0.179,-0.527,0.197,-0.501,0.226,-0.488,0.259,-0.493,0.321,-0.534,0.395,-0.575,0.45,-0.596,0.49,-0.604,0.563,-0.604,0.635,-0.592,0.685,-0.574,0.748,-0.54,0.736,-1.644,0.744,-1.675,0.77,-1.712,0.807,-1.736,0.847,-1.747,0.886,-1.745,0.908,-1.736,0.931,-1.71,0.936,-1.684,0.912,-0.592,0.913,-0.548,0.917,-0.527,0.927,-0.509,0.942,-0.496,0.961,-0.488,0.984,-0.489,1.018,-0.504,1.092,-0.554,1.158,-0.586,1.21,-0.602,1.28,-0.604,1.333,-0.599},\n    },\n  },\n  restWhole = {\n    x1 = 0, y1 = -0.036, x2 = 1.128, y2 = 0.54,\n    fill = {\n      {1.123,0.466,1.102,0.504,1.067,0.53,1.039,0.539,0.104,0.54,0.073,0.535,0.046,0.523,0.025,0.504,0.009,0.479,0.001,0.451,0,0.068,0.009,0.023,0.025,-0.001,0.046,-0.02,0.073,-0.032,0.104,-0.036,1.024,-0.036,1.067,-0.027,1.092,-0.011,1.111,0.01,1.127,0.052,1.128,0.436},\n    },\n  },\n  restHalf = {\n    x1 = 0, y1 = -0.568, x2 = 1.128, y2 = 0.008,\n    fill = {\n      {1.123,-0.066,1.102,-0.028,1.067,-0.002,1.039,0.007,0.104,0.008,0.073,0.003,0.046,-0.009,0.025,-0.028,0.009,-0.053,0.001,-0.081,0,-0.464,0.009,-0.509,0.025,-0.533,0.046,-0.552,0.073,-0.564,0.104,-0.568,1.024,-0.568,1.067,-0.559,1.092,-0.543,1.111,-0.522,1.127,-0.48,1.128,-0.096},\n    },\n  },\n  restQuarter = {\n    x1 = 0.005, y1 = -1.491, x2 = 1.079, y2 = 1.5,\n    fill = {\n      {0.106,-0.1,0.086,-0.134,0.077,-0.166,0.076,-0.194,0.081,-0.216,0.102,-0.263,0.226,-0.411,0.263,-0.465,0.308,-0.543,0.347,-0.644,0.36,-0.693,0.37,-0.763,0.372,-0.808,0.366,-0.888,0.35,-0.963,0.326,-1.033,0.297,-1.096,0.264,-1.154,0.214,-1.228,0.138,-1.327,0.117,-1.373,0.112,-1.408,0.122,-1.451,0.147,-1.479,0.18,-1.491,0.211,-1.49,0.239,-1.479,0.264,-1.46,0.288,-1.434,0.924,-0.688,0.938,-0.641,0.939,-0.595,0.929,-0.561,0.781,-0.325,0.738,-0.241,0.701,-0.153,0.674,-0.061,0.663,0.003,0.656,0.088,0.659,0.15,0.669,0.209,0.684,0.264,0.705,0.317,0.744,0.394,0.829,0.517,1.022,0.758,1.067,0.831,1.078,0.86,1.079,0.878,1.067,0.887,1.045,0.887,0.936,0.852,0.85,0.829,0.755,0.814,0.688,0.812,0.644,0.816,0.599,0.83,0.561,0.854,0.528,0.885,0.491,0.943,0.467,1.01,0.457,1.081,0.459,1.152,0.479,1.231,0.499,1.277,0.517,1.309,0.539,1.335,0.563,1.35,0.576,1.352,0.597,1.371,0.624,1.402,0.636,1.425,0.64,1.453,0.629,1.482,0.616,1.492,0.595,1.498,0.572,1.5,0.538,1.496,0.502,1.484,0.479,1.472,0.36,1.378,0.236,1.266,0.137,1.158,0.08,1.079,0.038,1,0.013,0.922,0.005,0.87,0.005,0.813,0.022,0.723,0.055,0.642,0.086,0.594,0.122,0.552,0.163,0.518,0.208,0.49,0.281,0.465,0.341,0.461,0.46,0.484,0.486,0.48,0.499,0.471,0.506,0.46,0.508,0.448,0.505,0.436,0.473,0.374,0.403,0.271,0.312,0.152},\n    },\n  },\n  rest8th = {\n    x1 = 0.001, y1 = -0.695, x2 = 0.988, y2 = 1.003,\n    fill = {\n      {0.536,-0.388,0.582,-0.396,0.657,-0.434,0.755,-0.511,0.896,-0.652,0.916,-0.663,0.94,-0.668,0.967,-0.649,0.982,-0.63,0.988,-0.604,0.948,-0.448,0.666,0.553,0.546,0.959,0.544,0.964,0.518,0.98,0.475,0.996,0.432,1.003,0.372,1.002,0.33,0.994,0.305,0.982,0.29,0.964,0.288,0.952,0.391,0.625,0.647,-0.125,0.662,-0.176,0.662,-0.23,0.651,-0.247,0.63,-0.246,0.567,-0.215,0.511,-0.194,0.428,-0.169,0.37,-0.159,0.288,-0.158,0.194,-0.179,0.156,-0.195,0.108,-0.224,0.069,-0.261,0.046,-0.289,0.019,-0.337,0.007,-0.372,0.001,-0.409,0.001,-0.452,0.01,-0.499,0.026,-0.543,0.049,-0.583,0.095,-0.633,0.153,-0.67,0.197,-0.686,0.244,-0.695,0.292,-0.695,0.339,-0.686,0.383,-0.67,0.423,-0.647,0.473,-0.601,0.499,-0.563,0.519,-0.522,0.532,-0.476},\n    },\n  },\n  rest16th = {\n    x1 = 0, y1 = -0.715, x2 = 1.279, y2 = 1.999,\n    fill = {\n      {0.832,-0.404,0.879,-0.413,0.955,-0.452,1.054,-0.53,1.196,-0.672,1.215,-0.683,1.24,-0.688,1.267,-0.67,1.278,-0.654,1.279,-0.641,1.242,-0.489,1.096,0.023,0.524,1.908,0.51,1.941,0.495,1.961,0.459,1.986,0.399,1.999,0.329,1.996,0.296,1.986,0.272,1.972,0.256,1.955,0.248,1.928,0.635,0.776,0.635,0.765,0.629,0.756,0.62,0.752,0.567,0.779,0.518,0.799,0.446,0.82,0.367,0.833,0.32,0.836,0.269,0.833,0.22,0.824,0.194,0.815,0.145,0.791,0.098,0.756,0.058,0.716,0.037,0.686,0.013,0.636,0.003,0.601,0,0.564,0.004,0.515,0.017,0.468,0.037,0.426,0.063,0.388,0.096,0.355,0.134,0.329,0.176,0.309,0.223,0.296,0.272,0.292,0.32,0.296,0.388,0.318,0.428,0.341,0.479,0.388,0.517,0.447,0.534,0.491,0.543,0.539,0.544,0.576,0.54,0.604,0.586,0.597,0.638,0.575,0.689,0.542,0.716,0.513,0.736,0.48,0.759,0.421,0.877,0.069,0.959,-0.192,0.968,-0.234,0.965,-0.256,0.954,-0.267,0.938,-0.266,0.822,-0.215,0.748,-0.192,0.687,-0.179,0.595,-0.172,0.557,-0.175,0.512,-0.184,0.472,-0.199,0.422,-0.225,0.386,-0.252,0.346,-0.292,0.316,-0.338,0.301,-0.372,0.289,-0.426,0.289,-0.469,0.298,-0.517,0.315,-0.561,0.338,-0.602,0.386,-0.653,0.444,-0.69,0.488,-0.706,0.536,-0.715,0.585,-0.715,0.633,-0.706,0.677,-0.69,0.718,-0.667,0.769,-0.62,0.795,-0.582,0.815,-0.54,0.828,-0.493},\n    },\n  },\n  rest32nd = {\n    x1 = 0, y1 = -1.704, x2 = 1.451, y2 = 1.999,\n    fill = {\n      {1.431,-1.67,1.445,-1.656,1.451,-1.629,1.344,-1.212,0.644,1.916,0.631,1.948,0.617,1.966,0.582,1.988,0.518,1.999,0.465,1.999,0.428,1.992,0.403,1.98,0.387,1.964,0.381,1.946,0.381,1.924,0.613,0.997,0.664,0.787,0.667,0.762,0.656,0.748,0.64,0.744,0.575,0.777,0.519,0.798,0.446,0.82,0.367,0.833,0.32,0.836,0.269,0.833,0.197,0.815,0.146,0.791,0.098,0.756,0.058,0.716,0.037,0.686,0.013,0.636,0.003,0.601,0,0.564,0.004,0.515,0.017,0.468,0.038,0.426,0.065,0.388,0.098,0.355,0.136,0.329,0.178,0.309,0.224,0.296,0.272,0.292,0.321,0.296,0.389,0.318,0.43,0.341,0.481,0.388,0.518,0.447,0.534,0.491,0.543,0.539,0.544,0.576,0.54,0.604,0.603,0.589,0.657,0.564,0.705,0.528,0.73,0.498,0.744,0.464,0.904,-0.192,0.895,-0.23,0.884,-0.242,0.868,-0.243,0.795,-0.207,0.712,-0.176,0.656,-0.161,0.61,-0.155,0.564,-0.152,0.513,-0.156,0.456,-0.168,0.417,-0.182,0.37,-0.207,0.32,-0.248,0.283,-0.289,0.264,-0.32,0.243,-0.37,0.237,-0.406,0.237,-0.449,0.246,-0.497,0.262,-0.541,0.285,-0.582,0.315,-0.617,0.35,-0.647,0.391,-0.67,0.435,-0.686,0.483,-0.695,0.532,-0.695,0.58,-0.686,0.624,-0.67,0.664,-0.647,0.715,-0.6,0.753,-0.541,0.77,-0.497,0.779,-0.449,0.78,-0.41,0.776,-0.388,0.807,-0.393,0.843,-0.405,0.919,-0.448,0.965,-0.49,0.992,-0.532,1.152,-1.188,1.149,-1.208,1.141,-1.229,1.127,-1.245,1.108,-1.252,1.096,-1.25,1.036,-1.221,0.952,-1.188,0.896,-1.173,0.834,-1.163,0.788,-1.16,0.739,-1.164,0.684,-1.176,0.631,-1.195,0.594,-1.215,0.544,-1.256,0.507,-1.297,0.488,-1.328,0.467,-1.378,0.461,-1.414,0.461,-1.457,0.47,-1.505,0.487,-1.549,0.51,-1.59,0.54,-1.625,0.596,-1.667,0.638,-1.687,0.684,-1.7,0.732,-1.704,0.781,-1.7,0.828,-1.687,0.87,-1.667,0.908,-1.641,0.941,-1.608,0.978,-1.549,0.994,-1.505,1.003,-1.457,1.004,-1.396,1.027,-1.398,1.076,-1.414,1.153,-1.46,1.249,-1.542,1.368,-1.66,1.387,-1.671,1.412,-1.676},\n    },\n  },\n  rest64th = {\n    x1 = 0.001, y1 = -1.72, x2 = 1.692, y2 = 3.012,\n    fill = {\n      {1.674,-1.683,1.685,-1.669,1.692,-1.632,1.584,-1.224,1.186,0.49,1.116,0.772,0.845,1.929,0.69,2.572,0.596,2.944,0.573,2.984,0.542,3.003,0.509,3.01,0.464,3.012,0.385,3.004,0.36,2.995,0.344,2.982,0.337,2.965,0.337,2.941,0.628,1.812,0.632,1.788,0.629,1.769,0.615,1.749,0.594,1.744,0.544,1.767,0.449,1.796,0.39,1.808,0.328,1.812,0.242,1.801,0.169,1.777,0.134,1.757,0.084,1.716,0.047,1.675,0.028,1.644,0.007,1.594,0.001,1.558,0.001,1.515,0.01,1.467,0.027,1.423,0.05,1.382,0.081,1.347,0.116,1.317,0.156,1.294,0.2,1.278,0.272,1.268,0.321,1.272,0.389,1.294,0.43,1.317,0.481,1.364,0.518,1.423,0.534,1.467,0.543,1.515,0.544,1.554,0.54,1.576,0.583,1.57,0.632,1.552,0.679,1.52,0.704,1.491,0.72,1.456,0.741,1.381,0.879,0.826,0.884,0.788,0.878,0.746,0.868,0.734,0.852,0.733,0.769,0.779,0.728,0.796,0.673,0.811,0.614,0.821,0.568,0.824,0.519,0.82,0.46,0.808,0.421,0.793,0.372,0.767,0.334,0.741,0.294,0.701,0.264,0.655,0.243,0.604,0.237,0.567,0.237,0.524,0.246,0.476,0.263,0.432,0.286,0.392,0.317,0.356,0.352,0.326,0.392,0.303,0.436,0.286,0.484,0.277,0.533,0.277,0.581,0.286,0.625,0.303,0.666,0.326,0.717,0.374,0.754,0.432,0.77,0.476,0.779,0.524,0.78,0.588,0.838,0.578,0.871,0.566,0.903,0.547,0.946,0.506,0.968,0.469,0.976,0.448,1.144,-0.215,1.138,-0.245,1.127,-0.255,1.117,-0.256,0.944,-0.192,0.855,-0.173,0.791,-0.168,0.737,-0.17,0.676,-0.18,0.636,-0.195,0.586,-0.221,0.55,-0.247,0.51,-0.287,0.48,-0.333,0.459,-0.384,0.453,-0.421,0.453,-0.464,0.462,-0.512,0.479,-0.556,0.502,-0.596,0.532,-0.631,0.568,-0.662,0.608,-0.685,0.652,-0.702,0.7,-0.711,0.749,-0.711,0.797,-0.702,0.841,-0.685,0.882,-0.662,0.933,-0.614,0.97,-0.556,0.986,-0.512,0.995,-0.464,0.996,-0.4,1.027,-0.404,1.063,-0.416,1.121,-0.446,1.159,-0.471,1.207,-0.514,1.236,-0.56,1.4,-1.218,1.399,-1.235,1.392,-1.253,1.38,-1.264,1.364,-1.268,1.341,-1.262,1.18,-1.196,1.094,-1.176,1.047,-1.172,0.993,-1.174,0.924,-1.188,0.885,-1.203,0.838,-1.229,0.788,-1.268,0.751,-1.309,0.732,-1.341,0.711,-1.392,0.705,-1.429,0.705,-1.472,0.714,-1.52,0.73,-1.564,0.753,-1.604,0.8,-1.655,0.838,-1.682,0.88,-1.703,0.927,-1.716,0.976,-1.72,1.024,-1.716,1.07,-1.703,1.112,-1.682,1.15,-1.655,1.183,-1.622,1.221,-1.564,1.238,-1.52,1.247,-1.472,1.248,-1.433,1.244,-1.408,1.267,-1.41,1.316,-1.426,1.393,-1.472,1.49,-1.554,1.612,-1.676,1.631,-1.687,1.656,-1.692},\n    },\n  },\n  timeSig0 = {\n    x1 = 0.08, y1 = -1.004, x2 = 1.799, y2 = 1,\n    fill = {\n      {1.773,0.25,1.748,0.344,1.715,0.433,1.676,0.518,1.629,0.598,1.577,0.672,1.487,0.772,1.421,0.829,1.35,0.879,1.275,0.921,1.196,0.955,1.114,0.98,1.028,0.995,0.94,1,0.852,0.995,0.766,0.98,0.684,0.955,0.605,0.921,0.53,0.879,0.459,0.829,0.393,0.772,0.332,0.707,0.276,0.636,0.227,0.559,0.184,0.477,0.147,0.389,0.119,0.297,0.097,0.201,0.084,0.102,0.08,-0,0.084,-0.103,0.088,-0.13,0.642,-0.13,0.641,0.026,0.649,0.181,0.667,0.325,0.693,0.456,0.715,0.535,0.74,0.606,0.782,0.696,0.831,0.763,0.865,0.794,0.883,0.805,0.921,0.818,0.94,0.82,0.959,0.818,0.995,0.805,1.031,0.78,1.064,0.743,1.111,0.668,1.139,0.606,1.164,0.535,1.205,0.37,1.226,0.23,1.238,0.078,1.239,-0.082,1.237,-0.13,1.792,-0.13,1.796,-0.103,1.799,0.051,1.79,0.152},\n      {1.238,0.07,1.239,-0.082,1.231,-0.238,1.213,-0.384,1.186,-0.515,1.164,-0.594,1.139,-0.665,1.111,-0.728,1.08,-0.78,1.031,-0.84,0.995,-0.865,0.977,-0.873,0.94,-0.88,0.902,-0.873,0.865,-0.854,0.814,-0.803,0.768,-0.728,0.74,-0.665,0.715,-0.594,0.675,-0.429,0.654,-0.288,0.642,-0.135,0.641,0.026,0.643,0.07,0.083,0.07,0.08,-0,0.084,-0.103,0.097,-0.203,0.119,-0.299,0.147,-0.391,0.184,-0.479,0.227,-0.562,0.276,-0.639,0.332,-0.711,0.393,-0.775,0.459,-0.833,0.53,-0.883,0.605,-0.925,0.684,-0.959,0.766,-0.984,0.852,-0.999,0.94,-1.004,1.028,-0.999,1.114,-0.984,1.196,-0.959,1.275,-0.925,1.35,-0.883,1.421,-0.833,1.487,-0.775,1.548,-0.711,1.604,-0.639,1.653,-0.562,1.696,-0.479,1.733,-0.391,1.761,-0.299,1.783,-0.203,1.796,-0.103,1.799,0.051,1.797,0.07},\n    },\n  },\n  timeSig1 = {\n    x1 = 0.08, y1 = -1.004, x2 = 1.255, y2 = 1,\n    fill = {\n      {0.485,-0.94,0.503,-0.975,0.519,-0.992,0.54,-1.003,0.552,-1.004,0.653,-0.992,0.78,-0.988,0.988,-1.004,1.03,-0.994,1.049,-0.981,1.061,-0.959,1.068,-0.912,1.069,0.753,1.089,0.803,1.124,0.844,1.167,0.87,1.228,0.884,1.246,0.901,1.254,0.92,1.255,0.944,1.25,0.963,1.237,0.983,1.211,0.998,1.192,1,0.34,1,0.298,0.994,0.268,0.978,0.256,0.96,0.252,0.936,0.253,0.921,0.263,0.899,0.29,0.881,0.374,0.868,0.425,0.845,0.453,0.822,0.476,0.794,0.491,0.761,0.495,0.743,0.496,-0.308,0.492,-0.34,0.484,-0.357,0.472,-0.364,0.463,-0.361,0.439,-0.335,0.213,0.034,0.195,0.053,0.174,0.062,0.156,0.064,0.124,0.056,0.096,0.038,0.085,0.023,0.08,-0,0.084,-0.026},\n    },\n  },\n  timeSig2 = {\n    x1 = 0.08, y1 = -1.015, x2 = 1.704, y2 = 1.027,\n    fill = {\n      {1.666,0.492,1.641,0.602,1.609,0.694,1.573,0.771,1.532,0.834,1.487,0.884,1.441,0.923,1.368,0.964,1.295,0.987,1.202,0.999,1.093,0.999,1.05,0.995,0.973,0.981,0.907,0.961,0.85,0.935,0.801,0.907,0.681,0.823,0.644,0.803,0.605,0.789,0.564,0.784,0.495,0.792,0.465,0.8,0.413,0.826,0.349,0.877,0.257,0.986,0.219,1.02,0.206,1.026,0.181,1.027,0.167,1.024,0.147,1.011,0.125,0.989,0.101,0.951,0.091,0.923,0.089,0.89,0.113,0.805,0.138,0.74,0.2,0.619,0.278,0.51,0.371,0.411,0.478,0.324,0.644,0.214,0.76,0.126,0.844,0.047,0.946,-0.069,1.017,-0.166,1.055,-0.232,1.076,-0.279,1.1,-0.351,1.112,-0.401,1.122,-0.479,1.124,-0.532,1.122,-0.608,1.116,-0.652,1.106,-0.699,1.089,-0.745,1.048,-0.81,1.008,-0.848,0.984,-0.865,0.925,-0.892,0.891,-0.902,0.81,-0.914,0.764,-0.916,0.687,-0.912,0.623,-0.902,0.571,-0.886,0.529,-0.866,0.497,-0.844,0.466,-0.808,0.45,-0.774,0.45,-0.752,0.456,-0.742,0.477,-0.722,0.586,-0.658,0.627,-0.63,0.681,-0.574,0.707,-0.526,0.722,-0.466,0.723,-0.398,0.715,-0.335,0.696,-0.265,0.663,-0.196,0.631,-0.155,0.591,-0.121,0.54,-0.096,0.479,-0.082,0.419,-0.081,0.37,-0.089,0.323,-0.103,0.279,-0.124,0.239,-0.151,0.202,-0.182,0.168,-0.218,0.14,-0.258,0.116,-0.3,0.099,-0.348,0.085,-0.411,0.08,-0.457,0.082,-0.515,0.089,-0.557,0.1,-0.597,0.123,-0.656,0.143,-0.694,0.179,-0.747,0.228,-0.802,0.287,-0.855,0.352,-0.901,0.422,-0.939,0.494,-0.968,0.543,-0.982,0.634,-1,0.728,-1.01,0.848,-1.015,0.966,-1.014,1.066,-1.003,1.158,-0.986,1.258,-0.959,1.326,-0.934,1.427,-0.885,1.49,-0.844,1.537,-0.805,1.57,-0.772,1.627,-0.695,1.651,-0.651,1.671,-0.604,1.693,-0.526,1.701,-0.469,1.704,-0.408,1.697,-0.32,1.686,-0.268,1.669,-0.22,1.648,-0.176,1.624,-0.136,1.596,-0.101,1.549,-0.054,1.507,-0.021,1.455,0.013,1.35,0.063,1.277,0.088,1.093,0.141,0.914,0.215,0.819,0.265,0.761,0.302,0.689,0.362,0.656,0.404,0.712,0.389,0.788,0.38,0.863,0.383,0.952,0.394,1.091,0.427,1.184,0.457,1.356,0.52,1.424,0.532,1.471,0.522,1.508,0.495,1.537,0.453,1.588,0.338,1.605,0.316,1.636,0.308,1.663,0.313,1.676,0.325,1.68,0.335,1.684,0.364},\n    },\n  },\n  timeSig3 = {\n    x1 = 0.08, y1 = -0.995, x2 = 1.604, y2 = 1.004,\n    fill = {\n      {0.95,-0.979,1.044,-0.958,1.146,-0.926,1.249,-0.881,1.345,-0.823,1.402,-0.775,1.45,-0.719,1.488,-0.656,1.512,-0.584,1.518,-0.545,1.52,-0.484,1.514,-0.426,1.506,-0.387,1.486,-0.332,1.468,-0.297,1.42,-0.234,1.367,-0.19,1.323,-0.163,1.254,-0.13,1.147,-0.101,1.137,-0.084,1.136,-0.063,1.144,-0.041,1.155,-0.034,1.312,0.008,1.396,0.056,1.455,0.1,1.511,0.162,1.557,0.232,1.588,0.314,1.604,0.42,1.598,0.521,1.59,0.556,1.567,0.622,1.534,0.683,1.491,0.74,1.441,0.791,1.382,0.837,1.317,0.878,1.247,0.913,1.172,0.943,1.093,0.967,1.011,0.985,0.927,0.997,0.842,1.003,0.764,1.004,0.633,0.997,0.551,0.986,0.474,0.972,0.403,0.952,0.307,0.913,0.226,0.863,0.161,0.8,0.128,0.75,0.114,0.723,0.094,0.664,0.087,0.633,0.08,0.564,0.081,0.526,0.089,0.469,0.099,0.431,0.121,0.379,0.154,0.333,0.209,0.283,0.273,0.244,0.326,0.224,0.382,0.212,0.447,0.215,0.512,0.232,0.552,0.251,0.59,0.275,0.638,0.321,0.672,0.376,0.687,0.431,0.692,0.5,0.686,0.547,0.672,0.588,0.618,0.693,0.605,0.728,0.6,0.784,0.609,0.811,0.627,0.829,0.665,0.842,0.738,0.852,0.79,0.848,0.842,0.835,0.878,0.817,0.915,0.791,0.95,0.756,0.983,0.709,1.011,0.65,1.033,0.576,1.047,0.487,1.052,0.38,1.047,0.332,1.031,0.276,1,0.212,0.967,0.168,0.924,0.125,0.869,0.087,0.836,0.07,0.76,0.041,0.715,0.031,0.614,0.018,0.533,0.016,0.494,0.01,0.472,-0,0.463,-0.009,0.456,-0.032,0.458,-0.044,0.469,-0.065,0.489,-0.081,0.514,-0.092,0.54,-0.098,0.617,-0.106,0.681,-0.116,0.742,-0.132,0.8,-0.153,0.879,-0.197,0.945,-0.255,0.981,-0.302,0.996,-0.328,1.02,-0.385,1.028,-0.417,1.039,-0.486,1.04,-0.552,1.037,-0.599,1.026,-0.655,1.001,-0.714,0.957,-0.769,0.916,-0.801,0.89,-0.816,0.831,-0.839,0.757,-0.855,0.658,-0.859,0.616,-0.851,0.582,-0.839,0.534,-0.813,0.511,-0.789,0.504,-0.775,0.5,-0.744,0.506,-0.717,0.513,-0.709,0.532,-0.698,0.58,-0.688,0.629,-0.671,0.669,-0.641,0.692,-0.606,0.708,-0.556,0.712,-0.524,0.711,-0.47,0.705,-0.427,0.692,-0.386,0.672,-0.347,0.646,-0.312,0.613,-0.283,0.574,-0.259,0.529,-0.242,0.477,-0.233,0.428,-0.232,0.39,-0.236,0.323,-0.251,0.266,-0.274,0.241,-0.289,0.199,-0.322,0.152,-0.381,0.122,-0.446,0.107,-0.513,0.106,-0.582,0.11,-0.607,0.129,-0.658,0.177,-0.732,0.247,-0.802,0.304,-0.845,0.367,-0.884,0.437,-0.919,0.511,-0.948,0.628,-0.979,0.751,-0.995,0.852,-0.992},\n    },\n  },\n  timeSig4 = {\n    x1 = 0.08, y1 = -1.004, x2 = 1.799, y2 = 1,\n    fill = {\n      {1.754,0.297,1.765,0.3,1.783,0.312,1.797,0.343,1.799,0.387,1.793,0.413,1.781,0.432,1.764,0.444,1.74,0.448,1.448,0.448,1.449,0.712,1.453,0.736,1.468,0.775,1.489,0.803,1.514,0.821,1.551,0.834,1.597,0.839,1.631,0.855,1.649,0.874,1.659,0.9,1.659,0.932,1.643,0.97,1.625,0.987,1.592,0.999,0.728,1,0.697,0.995,0.675,0.982,0.657,0.952,0.653,0.904,0.666,0.872,0.684,0.855,0.71,0.844,0.791,0.835,0.837,0.819,0.875,0.789,0.893,0.759,0.903,0.722,0.904,0.7,0.904,0.448,0.16,0.448,0.122,0.441,0.102,0.429,0.088,0.412,0.081,0.392,0.08,0.374,0.096,0.324,0.219,0.148,0.329,-0.027,0.421,-0.195,0.507,-0.38,0.561,-0.527,0.59,-0.627,0.621,-0.778,0.634,-0.946,0.645,-0.973,0.664,-0.99,0.688,-1,0.724,-1.004,1.008,-0.996,1.28,-1.004,1.303,-1,1.322,-0.988,1.335,-0.97,1.34,-0.948,1.336,-0.928,1.317,-0.894,1.198,-0.719,1.039,-0.5,0.849,-0.25,0.689,-0.051,0.572,0.086,0.462,0.204,0.364,0.296,0.904,0.296,0.904,-0.04,0.907,-0.069,0.918,-0.101,0.94,-0.132,1.32,-0.592,1.338,-0.609,1.355,-0.621,1.4,-0.628,1.424,-0.623,1.438,-0.61,1.445,-0.592,1.448,-0.571,1.448,0.296},\n    },\n  },\n  timeSig5 = {\n    x1 = 0.08, y1 = -0.984, x2 = 1.531, y2 = 1.004,\n    fill = {\n      {0.305,-0.207,0.309,-0.197,0.329,-0.193,0.404,-0.229,0.475,-0.257,0.61,-0.291,0.701,-0.304,0.801,-0.311,0.872,-0.312,0.952,-0.307,1.029,-0.293,1.137,-0.256,1.237,-0.202,1.325,-0.132,1.377,-0.077,1.422,-0.017,1.476,0.083,1.513,0.191,1.531,0.308,1.528,0.424,1.516,0.498,1.496,0.568,1.468,0.635,1.433,0.699,1.366,0.785,1.282,0.859,1.217,0.901,1.107,0.952,1.024,0.977,0.888,1,0.788,1.004,0.634,0.998,0.5,0.98,0.422,0.961,0.32,0.922,0.263,0.889,0.192,0.83,0.154,0.784,0.113,0.704,0.088,0.612,0.08,0.508,0.087,0.414,0.096,0.369,0.11,0.325,0.131,0.283,0.158,0.245,0.211,0.195,0.28,0.159,0.336,0.145,0.367,0.141,0.453,0.144,0.503,0.157,0.55,0.178,0.592,0.205,0.629,0.239,0.674,0.3,0.702,0.372,0.711,0.425,0.711,0.474,0.7,0.538,0.685,0.579,0.665,0.616,0.64,0.651,0.611,0.681,0.528,0.742,0.517,0.757,0.512,0.776,0.524,0.803,0.56,0.832,0.605,0.843,0.666,0.844,0.735,0.833,0.793,0.81,0.852,0.77,0.888,0.731,0.922,0.682,0.95,0.62,0.973,0.544,0.987,0.454,0.992,0.348,0.986,0.244,0.971,0.155,0.947,0.079,0.915,0.016,0.878,-0.036,0.837,-0.079,0.77,-0.125,0.702,-0.153,0.637,-0.168,0.58,-0.172,0.503,-0.162,0.437,-0.137,0.366,-0.092,0.308,-0.04,0.256,0.025,0.24,0.036,0.22,0.04,0.185,0.037,0.165,0.029,0.15,0.016,0.141,-0.006,0.14,-0.028,0.184,-0.916,0.189,-0.935,0.199,-0.954,0.228,-0.975,0.28,-0.984,0.58,-0.957,0.798,-0.944,0.96,-0.951,1.301,-0.98,1.335,-0.976,1.351,-0.965,1.361,-0.948,1.366,-0.925,1.366,-0.863,1.352,-0.795,1.325,-0.733,1.297,-0.691,1.259,-0.649,1.208,-0.61,1.144,-0.575,1.065,-0.546,1.02,-0.534,0.915,-0.518,0.856,-0.513,0.761,-0.512,0.636,-0.519,0.523,-0.53,0.4,-0.548,0.371,-0.547,0.35,-0.54,0.335,-0.527,0.324,-0.496,0.304,-0.236},\n    },\n  },\n  timeSig6 = {\n    x1 = 0.08, y1 = -1.004, x2 = 1.655, y2 = 0.996,\n    fill = {\n      {1.653,0.437,1.638,0.521,1.621,0.576,1.586,0.654,1.541,0.728,1.506,0.773,1.446,0.834,1.401,0.87,1.352,0.901,1.3,0.926,1.246,0.947,1.161,0.971,1.074,0.986,0.986,0.994,0.9,0.996,0.816,0.993,0.729,0.983,0.664,0.969,0.6,0.948,0.531,0.915,0.462,0.868,0.396,0.811,0.335,0.746,0.281,0.677,0.218,0.58,0.178,0.504,0.146,0.421,0.124,0.341,0.663,0.341,0.657,0.403,0.657,0.477,0.663,0.548,0.682,0.646,0.701,0.705,0.737,0.78,0.781,0.838,0.815,0.865,0.85,0.882,0.888,0.888,0.926,0.882,0.944,0.875,0.979,0.853,1.011,0.821,1.054,0.757,1.088,0.676,1.105,0.615,1.121,0.513,1.124,0.44,1.121,0.367,1.117,0.341,1.654,0.341,1.655,0.345},\n      {0.976,-0.5,0.966,-0.547,0.965,-0.607,0.972,-0.646,0.986,-0.684,1.008,-0.72,1.08,-0.807,1.09,-0.834,1.091,-0.858,1.073,-0.884,1.035,-0.9,0.96,-0.908,0.897,-0.901,0.866,-0.89,0.834,-0.872,0.784,-0.826,0.735,-0.754,0.692,-0.647,0.657,-0.5,0.641,-0.376,0.628,-0.148,0.632,-0.095,0.639,-0.071,0.656,-0.053,0.678,-0.054,0.749,-0.107,0.838,-0.155,0.932,-0.186,1.028,-0.199,1.098,-0.198,1.191,-0.182,1.258,-0.16,1.346,-0.117,1.428,-0.061,1.505,0.009,1.573,0.092,1.613,0.166,1.641,0.25,1.655,0.345,1.653,0.437,1.638,0.521,1.632,0.541,1.117,0.541,1.121,0.513,1.124,0.44,1.121,0.367,1.105,0.265,1.088,0.204,1.054,0.123,1.011,0.059,0.962,0.015,0.926,-0.002,0.907,-0.007,0.869,-0.007,0.832,0.005,0.781,0.042,0.751,0.078,0.712,0.148,0.682,0.234,0.668,0.298,0.657,0.403,0.657,0.477,0.662,0.541,0.197,0.541,0.178,0.504,0.146,0.421,0.114,0.304,0.097,0.214,0.084,0.093,0.08,-0.012,0.084,-0.098,0.097,-0.186,0.117,-0.274,0.163,-0.419,0.198,-0.502,0.236,-0.58,0.294,-0.673,0.338,-0.728,0.387,-0.779,0.468,-0.846,0.527,-0.884,0.589,-0.917,0.653,-0.945,0.72,-0.967,0.789,-0.984,0.86,-0.996,0.968,-1.004,1.097,-0.997,1.204,-0.978,1.306,-0.943,1.35,-0.922,1.392,-0.896,1.448,-0.849,1.493,-0.793,1.524,-0.728,1.538,-0.672,1.54,-0.644,1.536,-0.591,1.525,-0.547,1.507,-0.505,1.469,-0.447,1.438,-0.414,1.402,-0.385,1.362,-0.363,1.32,-0.348,1.257,-0.335,1.204,-0.332,1.156,-0.339,1.109,-0.354,1.066,-0.378,1.036,-0.403,1.004,-0.441},\n    },\n  },\n  timeSig7 = {\n    x1 = 0.08, y1 = -0.996, x2 = 1.683, y2 = 1,\n    fill = {\n      {1.683,-0.763,1.674,-0.687,1.656,-0.608,1.632,-0.526,1.567,-0.352,1.364,0.131,1.307,0.289,1.275,0.397,1.247,0.508,1.226,0.62,1.213,0.735,1.206,0.903,1.2,0.942,1.185,0.98,1.171,0.993,1.144,1,0.91,0.97,0.816,0.964,0.749,0.969,0.573,0.999,0.524,0.997,0.503,0.987,0.485,0.958,0.48,0.914,0.481,0.853,0.493,0.779,0.508,0.727,0.541,0.644,0.568,0.587,0.617,0.502,0.713,0.364,0.817,0.242,0.943,0.111,1.171,-0.113,1.235,-0.183,1.267,-0.224,1.29,-0.261,1.302,-0.293,1.302,-0.319,1.289,-0.34,1.271,-0.343,1.24,-0.328,1.177,-0.281,1.128,-0.258,1.065,-0.245,1.009,-0.246,0.978,-0.251,0.917,-0.27,0.83,-0.316,0.775,-0.354,0.619,-0.472,0.546,-0.518,0.5,-0.537,0.478,-0.542,0.429,-0.542,0.403,-0.537,0.358,-0.517,0.338,-0.502,0.303,-0.468,0.274,-0.427,0.239,-0.358,0.163,-0.161,0.143,-0.137,0.124,-0.132,0.112,-0.134,0.102,-0.14,0.089,-0.159,0.08,-0.196,0.08,-0.856,0.087,-0.887,0.099,-0.898,0.113,-0.903,0.129,-0.903,0.145,-0.898,0.164,-0.883,0.183,-0.851,0.215,-0.813,0.251,-0.786,0.272,-0.78,0.297,-0.787,0.326,-0.805,0.463,-0.927,0.497,-0.949,0.539,-0.967,0.591,-0.982,0.653,-0.992,0.728,-0.996,0.811,-0.989,0.851,-0.98,0.925,-0.955,1.025,-0.901,1.112,-0.837,1.288,-0.683,1.32,-0.663,1.348,-0.656,1.383,-0.666,1.4,-0.677,1.429,-0.71,1.467,-0.776,1.532,-0.932,1.54,-0.942,1.565,-0.958,1.616,-0.976,1.645,-0.972,1.664,-0.959,1.675,-0.936,1.681,-0.905},\n    },\n  },\n  timeSig8 = {\n    x1 = 0.081, y1 = -1.036, x2 = 1.663, y2 = 1.036,\n    fill = {\n      {0.836,1.036,0.749,1.033,0.622,1.019,0.541,1.003,0.464,0.982,0.392,0.954,0.325,0.922,0.265,0.883,0.212,0.839,0.166,0.789,0.13,0.732,0.115,0.702,0.093,0.637,0.086,0.602,0.081,0.566,0.081,0.493,0.089,0.427,0.106,0.367,0.143,0.287,0.177,0.24,0.216,0.197,0.26,0.158,0.309,0.122,0.362,0.089,0.448,0.044,0.372,-0.003,0.324,-0.037,0.259,-0.094,0.22,-0.136,0.17,-0.208,0.144,-0.261,0.123,-0.319,0.108,-0.382,0.101,-0.451,0.101,-0.524,0.111,-0.592,0.129,-0.656,0.157,-0.715,0.192,-0.771,0.236,-0.821,0.288,-0.867,0.346,-0.908,0.412,-0.943,0.522,-0.986,0.604,-1.008,0.691,-1.023,0.831,-1.035,0.894,-1.036,0.983,-1.028,1.004,-1.024,1.004,-0.903,0.986,-0.908,0.872,-0.92,0.762,-0.91,0.68,-0.889,0.628,-0.869,0.581,-0.844,0.522,-0.797,0.493,-0.759,0.475,-0.716,0.468,-0.668,0.47,-0.639,0.474,-0.611,0.493,-0.56,0.522,-0.515,0.561,-0.475,0.635,-0.423,0.757,-0.364,0.862,-0.325,1.004,-0.277,1.004,0.305,0.999,0.302,0.906,0.254,0.624,0.132,0.544,0.17,0.471,0.218,0.409,0.275,0.36,0.339,0.326,0.409,0.313,0.458,0.308,0.508,0.309,0.541,0.32,0.603,0.34,0.66,0.354,0.686,0.387,0.734,0.428,0.776,0.502,0.828,0.558,0.855,0.651,0.885,0.717,0.897,0.82,0.904,0.896,0.9,0.994,0.88,1.004,0.876,1.004,1.025,0.956,1.031},\n      {1.483,-0.051,1.544,0.005,1.579,0.047,1.621,0.117,1.641,0.17,1.656,0.228,1.663,0.29,1.663,0.377,1.652,0.475,1.642,0.521,1.616,0.605,1.581,0.681,1.538,0.749,1.488,0.808,1.431,0.859,1.368,0.904,1.3,0.941,1.228,0.971,1.115,1.005,1.036,1.021,0.956,1.031,0.836,1.036,0.804,1.035,0.804,0.903,0.82,0.904,0.896,0.9,0.994,0.88,1.074,0.846,1.135,0.799,1.178,0.742,1.204,0.678,1.212,0.608,1.206,0.546,1.189,0.49,1.161,0.44,1.124,0.396,1.054,0.337,0.999,0.302,0.906,0.254,0.804,0.21,0.804,-0.347,0.862,-0.325,1.128,-0.236,1.212,-0.295,1.263,-0.346,1.301,-0.405,1.327,-0.472,1.337,-0.522,1.34,-0.576,1.332,-0.647,1.31,-0.708,1.294,-0.735,1.255,-0.783,1.232,-0.803,1.181,-0.838,1.098,-0.877,0.986,-0.908,0.872,-0.92,0.804,-0.914,0.804,-1.033,0.831,-1.035,0.894,-1.036,0.983,-1.028,1.075,-1.013,1.143,-0.997,1.215,-0.975,1.286,-0.947,1.388,-0.893,1.449,-0.847,1.476,-0.82,1.522,-0.761,1.541,-0.727,1.567,-0.653,1.574,-0.612,1.575,-0.537,1.564,-0.45,1.549,-0.398,1.529,-0.349,1.503,-0.305,1.457,-0.244,1.4,-0.191,1.336,-0.144,1.438,-0.085},\n    },\n  },\n  timeSig9 = {\n    x1 = 0.081, y1 = -1.004, x2 = 1.656, y2 = 0.996,\n    fill = {\n      {0.76,0.492,0.77,0.539,0.771,0.599,0.764,0.638,0.75,0.676,0.728,0.712,0.656,0.799,0.646,0.826,0.645,0.85,0.663,0.876,0.701,0.892,0.776,0.9,0.839,0.893,0.87,0.882,0.902,0.864,0.952,0.818,1.001,0.746,1.044,0.639,1.079,0.492,1.095,0.368,1.108,0.14,1.104,0.087,1.097,0.063,1.08,0.045,1.058,0.046,0.987,0.099,0.898,0.147,0.804,0.178,0.708,0.191,0.638,0.19,0.545,0.174,0.478,0.152,0.39,0.109,0.308,0.053,0.231,-0.017,0.163,-0.1,0.123,-0.174,0.095,-0.258,0.081,-0.353,0.083,-0.445,0.098,-0.529,0.104,-0.549,0.619,-0.549,0.615,-0.521,0.612,-0.448,0.615,-0.375,0.631,-0.273,0.648,-0.212,0.682,-0.131,0.725,-0.067,0.774,-0.023,0.81,-0.006,0.829,-0.001,0.867,-0.001,0.904,-0.013,0.955,-0.05,0.985,-0.086,1.024,-0.156,1.054,-0.242,1.068,-0.306,1.079,-0.411,1.079,-0.485,1.074,-0.549,1.539,-0.549,1.558,-0.512,1.59,-0.429,1.622,-0.312,1.639,-0.222,1.652,-0.101,1.656,0.004,1.652,0.09,1.639,0.178,1.619,0.266,1.573,0.411,1.538,0.494,1.5,0.572,1.442,0.665,1.398,0.72,1.349,0.771,1.268,0.838,1.209,0.876,1.147,0.909,1.083,0.937,1.016,0.959,0.947,0.976,0.876,0.988,0.768,0.996,0.639,0.989,0.532,0.97,0.43,0.935,0.386,0.914,0.344,0.888,0.288,0.841,0.243,0.785,0.212,0.72,0.198,0.664,0.196,0.636,0.2,0.583,0.211,0.539,0.229,0.497,0.267,0.439,0.298,0.406,0.334,0.377,0.374,0.355,0.416,0.34,0.479,0.327,0.532,0.324,0.58,0.331,0.627,0.346,0.67,0.37,0.7,0.395,0.732,0.433},\n      {0.083,-0.445,0.098,-0.529,0.115,-0.584,0.15,-0.662,0.195,-0.736,0.23,-0.781,0.29,-0.842,0.335,-0.878,0.384,-0.909,0.436,-0.934,0.49,-0.955,0.575,-0.979,0.662,-0.994,0.75,-1.002,0.836,-1.004,0.92,-1.001,1.007,-0.991,1.072,-0.977,1.136,-0.956,1.205,-0.923,1.274,-0.876,1.34,-0.819,1.401,-0.754,1.455,-0.685,1.518,-0.588,1.558,-0.512,1.59,-0.429,1.612,-0.349,1.073,-0.349,1.079,-0.411,1.079,-0.485,1.073,-0.556,1.054,-0.654,1.035,-0.713,0.999,-0.788,0.955,-0.846,0.921,-0.873,0.886,-0.89,0.848,-0.896,0.81,-0.89,0.792,-0.883,0.757,-0.861,0.725,-0.829,0.682,-0.765,0.648,-0.684,0.631,-0.623,0.615,-0.521,0.612,-0.448,0.615,-0.375,0.619,-0.349,0.082,-0.349,0.081,-0.353},\n    },\n  },\n  tuplet0 = {\n    x1 = 0.001, y1 = -1.499, x2 = 1.272, y2 = 0.031,\n    fill = {\n      {1.23,-0.729,1.2,-0.636,1.165,-0.545,1.125,-0.46,1.082,-0.381,1.035,-0.309,0.984,-0.243,0.93,-0.184,0.873,-0.131,0.812,-0.086,0.75,-0.047,0.684,-0.016,0.617,0.007,0.548,0.023,0.476,0.031,0.399,0.031,0.325,0.022,0.291,0.014,0.229,-0.008,0.201,-0.022,0.151,-0.056,0.109,-0.096,0.075,-0.142,0.036,-0.222,0.018,-0.281,0.006,-0.344,0.001,-0.41,0.001,-0.488,0.016,-0.624,0.049,-0.761,0.075,-0.834,0.431,-0.834,0.396,-0.732,0.359,-0.601,0.335,-0.491,0.318,-0.383,0.312,-0.284,0.317,-0.21,0.332,-0.149,0.359,-0.103,0.385,-0.084,0.4,-0.077,0.436,-0.072,0.458,-0.074,0.481,-0.079,0.524,-0.099,0.587,-0.151,0.648,-0.225,0.705,-0.316,0.774,-0.459,0.821,-0.576,0.876,-0.736,0.904,-0.834,1.253,-0.834,1.251,-0.821},\n      {1.011,-1.471,1.07,-1.445,1.12,-1.411,1.162,-1.371,1.197,-1.324,1.225,-1.272,1.246,-1.215,1.261,-1.155,1.269,-1.091,1.272,-1.002,1.265,-0.913,1.251,-0.821,1.23,-0.729,1.2,-0.636,1.199,-0.634,0.841,-0.634,0.876,-0.736,0.913,-0.866,0.942,-1.002,0.958,-1.132,0.958,-1.228,0.953,-1.271,0.943,-1.31,0.919,-1.356,0.896,-1.378,0.867,-1.391,0.832,-1.396,0.81,-1.394,0.767,-1.38,0.746,-1.369,0.704,-1.337,0.663,-1.294,0.604,-1.213,0.549,-1.116,0.498,-1.007,0.451,-0.891,0.396,-0.732,0.368,-0.634,0.019,-0.634,0.049,-0.761,0.106,-0.923,0.166,-1.048,0.235,-1.159,0.312,-1.256,0.367,-1.312,0.425,-1.361,0.487,-1.402,0.551,-1.437,0.651,-1.475,0.756,-1.496,0.869,-1.499,0.945,-1.489},\n    },\n  },\n  tuplet1 = {\n    x1 = 0.04, y1 = -1.487, x2 = 1.024, y2 = -0,\n    fill = {\n      {0.664,-1.456,0.689,-1.477,0.717,-1.487,0.742,-1.487,0.824,-1.456,0.852,-1.452,0.877,-1.456,0.975,-1.487,0.998,-1.487,1.017,-1.474,1.024,-1.448,1.016,-1.404,0.628,-0.18,0.621,-0.148,0.623,-0.134,0.634,-0.126,0.78,-0.112,0.812,-0.101,0.825,-0.087,0.832,-0.056,0.826,-0.027,0.807,-0.007,0.772,-0,0.1,-0,0.067,-0.007,0.047,-0.027,0.04,-0.056,0.044,-0.078,0.054,-0.095,0.072,-0.106,0.096,-0.112,0.249,-0.126,0.266,-0.133,0.276,-0.145,0.556,-1.016,0.564,-1.059,0.561,-1.079,0.555,-1.086,0.544,-1.088,0.53,-1.086,0.516,-1.078,0.327,-0.873,0.311,-0.86,0.293,-0.851,0.272,-0.848,0.249,-0.852,0.23,-0.864,0.212,-0.889,0.208,-0.908,0.211,-0.925,0.24,-0.976},\n    },\n  },\n  tuplet2 = {\n    x1 = 0.04, y1 = -1.5, x2 = 1.315, y2 = 0.024,\n    fill = {\n      {0.956,-1.493,1.025,-1.48,1.087,-1.462,1.167,-1.423,1.212,-1.391,1.249,-1.353,1.278,-1.311,1.299,-1.263,1.315,-1.184,1.315,-1.115,1.304,-1.038,1.295,-1.002,1.271,-0.936,1.238,-0.877,1.197,-0.823,1.149,-0.776,1.066,-0.715,1.004,-0.681,0.903,-0.637,0.795,-0.603,0.614,-0.554,0.493,-0.504,0.429,-0.466,0.373,-0.422,0.322,-0.365,0.311,-0.345,0.309,-0.33,0.316,-0.321,0.331,-0.321,0.401,-0.349,0.442,-0.361,0.501,-0.37,0.572,-0.371,0.66,-0.355,0.825,-0.307,0.866,-0.301,0.922,-0.302,0.969,-0.314,0.997,-0.328,1.036,-0.359,1.089,-0.422,1.111,-0.431,1.131,-0.431,1.151,-0.425,1.168,-0.413,1.179,-0.395,1.18,-0.377,1.142,-0.264,1.105,-0.178,1.077,-0.129,1.046,-0.087,0.993,-0.035,0.929,0.001,0.854,0.02,0.796,0.024,0.721,0.019,0.625,-0.003,0.543,-0.037,0.369,-0.13,0.329,-0.143,0.288,-0.148,0.256,-0.144,0.221,-0.123,0.197,-0.089,0.17,-0.03,0.147,-0.001,0.117,0.011,0.091,0.011,0.07,0.004,0.048,-0.016,0.04,-0.048,0.046,-0.088,0.071,-0.175,0.105,-0.265,0.133,-0.322,0.183,-0.402,0.224,-0.453,0.269,-0.501,0.321,-0.547,0.41,-0.611,0.516,-0.669,0.676,-0.74,0.776,-0.799,0.83,-0.843,0.876,-0.888,0.913,-0.936,0.943,-0.985,0.974,-1.061,0.991,-1.139,0.996,-1.216,0.995,-1.243,0.985,-1.288,0.966,-1.323,0.954,-1.337,0.925,-1.359,0.871,-1.38,0.809,-1.388,0.733,-1.384,0.666,-1.367,0.617,-1.34,0.594,-1.319,0.581,-1.297,0.576,-1.276,0.58,-1.255,0.589,-1.237,0.627,-1.196,0.647,-1.168,0.662,-1.13,0.668,-1.084,0.664,-1.042,0.652,-1.002,0.621,-0.949,0.593,-0.921,0.541,-0.891,0.501,-0.881,0.455,-0.881,0.41,-0.891,0.375,-0.908,0.347,-0.933,0.328,-0.963,0.311,-1.015,0.308,-1.052,0.312,-1.109,0.334,-1.192,0.359,-1.244,0.391,-1.294,0.453,-1.361,0.529,-1.418,0.62,-1.462,0.724,-1.49,0.84,-1.5},\n    },\n  },\n  tuplet3 = {\n    x1 = 0.041, y1 = -1.499, x2 = 1.223, y2 = 0.031,\n    fill = {\n      {0.564,-0.829,0.654,-0.844,0.731,-0.875,0.794,-0.921,0.843,-0.981,0.877,-1.052,0.896,-1.133,0.899,-1.21,0.888,-1.262,0.872,-1.295,0.848,-1.324,0.815,-1.348,0.774,-1.365,0.722,-1.375,0.65,-1.373,0.601,-1.361,0.57,-1.342,0.56,-1.32,0.57,-1.302,0.615,-1.26,0.631,-1.231,0.639,-1.208,0.643,-1.182,0.643,-1.147,0.635,-1.107,0.62,-1.071,0.598,-1.04,0.571,-1.015,0.521,-0.989,0.464,-0.98,0.428,-0.984,0.395,-0.995,0.355,-1.024,0.327,-1.068,0.313,-1.123,0.314,-1.181,0.326,-1.236,0.36,-1.309,0.393,-1.352,0.455,-1.407,0.53,-1.45,0.587,-1.472,0.648,-1.487,0.746,-1.499,0.848,-1.497,0.945,-1.479,1.031,-1.447,1.105,-1.402,1.163,-1.344,1.192,-1.298,1.203,-1.274,1.219,-1.221,1.223,-1.193,1.22,-1.115,1.207,-1.067,1.187,-1.023,1.144,-0.961,1.087,-0.906,1.044,-0.874,0.997,-0.845,0.888,-0.791,0.876,-0.782,0.872,-0.772,0.881,-0.753,0.955,-0.713,1.003,-0.671,1.038,-0.621,1.055,-0.585,1.066,-0.547,1.072,-0.488,1.061,-0.383,1.042,-0.319,0.999,-0.231,0.96,-0.178,0.889,-0.11,0.805,-0.053,0.709,-0.011,0.604,0.018,0.529,0.028,0.411,0.031,0.335,0.022,0.268,0.006,0.21,-0.017,0.161,-0.046,0.103,-0.098,0.075,-0.139,0.049,-0.205,0.041,-0.252,0.044,-0.324,0.055,-0.368,0.072,-0.407,0.096,-0.442,0.125,-0.469,0.158,-0.49,0.195,-0.503,0.236,-0.508,0.291,-0.5,0.337,-0.477,0.37,-0.439,0.387,-0.385,0.387,-0.339,0.372,-0.278,0.344,-0.234,0.311,-0.204,0.257,-0.176,0.24,-0.159,0.238,-0.133,0.249,-0.114,0.285,-0.09,0.338,-0.075,0.38,-0.072,0.446,-0.078,0.477,-0.086,0.534,-0.109,0.584,-0.142,0.627,-0.182,0.68,-0.253,0.707,-0.305,0.727,-0.359,0.74,-0.413,0.747,-0.466,0.747,-0.516,0.74,-0.559,0.727,-0.599,0.706,-0.633,0.679,-0.661,0.645,-0.684,0.58,-0.704,0.457,-0.711,0.424,-0.728,0.409,-0.756,0.409,-0.78,0.417,-0.8,0.444,-0.82,0.488,-0.828},\n    },\n  },\n  tuplet4 = {\n    x1 = 0.04, y1 = -1.488, x2 = 1.252, y2 = -0,\n    fill = {\n      {1.196,-0.524,1.218,-0.52,1.243,-0.502,1.252,-0.468,1.243,-0.436,1.217,-0.416,1.192,-0.412,1.045,-0.411,1.03,-0.406,1.018,-0.388,0.952,-0.18,0.945,-0.14,0.951,-0.129,0.958,-0.126,1.104,-0.112,1.127,-0.106,1.143,-0.095,1.155,-0.067,1.155,-0.046,1.15,-0.027,1.131,-0.007,1.096,-0,0.424,-0,0.391,-0.007,0.371,-0.027,0.364,-0.056,0.368,-0.078,0.386,-0.101,0.42,-0.112,0.573,-0.126,0.595,-0.138,0.608,-0.164,0.676,-0.384,0.673,-0.406,0.656,-0.412,0.097,-0.413,0.072,-0.418,0.054,-0.429,0.044,-0.445,0.04,-0.464,0.043,-0.483,0.057,-0.507,0.192,-0.647,0.295,-0.759,0.391,-0.875,0.48,-0.996,0.546,-1.098,0.616,-1.229,0.66,-1.33,0.707,-1.461,0.724,-1.48,0.752,-1.488,0.793,-1.482,0.889,-1.458,0.944,-1.452,0.995,-1.458,1.102,-1.485,1.145,-1.487,1.169,-1.477,1.175,-1.464,1.176,-1.45,1.164,-1.419,1.089,-1.324,0.986,-1.206,0.87,-1.083,0.745,-0.957,0.579,-0.802,0.443,-0.683,0.3,-0.565,0.29,-0.554,0.288,-0.54,0.299,-0.527,0.32,-0.524,0.68,-0.524,0.705,-0.53,0.72,-0.556,0.798,-0.803,0.818,-0.839,1.121,-1.165,1.14,-1.178,1.16,-1.186,1.206,-1.186,1.224,-1.181,1.236,-1.169,1.24,-1.152,1.238,-1.137,1.224,-1.076,1.06,-0.556,1.062,-0.531,1.08,-0.524},\n    },\n  },\n  tuplet5 = {\n    x1 = 0.041, y1 = -1.492, x2 = 1.308, y2 = 0.031,\n    fill = {\n      {0.44,-1.412,0.452,-1.44,0.478,-1.467,0.514,-1.479,0.546,-1.479,0.741,-1.437,0.827,-1.429,0.901,-1.428,0.994,-1.433,1.079,-1.443,1.137,-1.454,1.272,-1.492,1.288,-1.488,1.3,-1.479,1.308,-1.456,1.303,-1.429,1.285,-1.401,1.256,-1.368,1.152,-1.284,1.079,-1.239,1.026,-1.212,0.912,-1.17,0.849,-1.156,0.784,-1.147,0.684,-1.145,0.524,-1.16,0.507,-1.154,0.5,-1.147,0.488,-1.124,0.425,-0.931,0.424,-0.91,0.432,-0.896,0.451,-0.891,0.466,-0.892,0.576,-0.917,0.672,-0.924,0.777,-0.918,0.869,-0.9,0.946,-0.868,1.009,-0.822,1.041,-0.784,1.054,-0.762,1.075,-0.714,1.091,-0.628,1.088,-0.515,1.075,-0.437,1.04,-0.331,1.008,-0.266,0.946,-0.179,0.897,-0.129,0.812,-0.065,0.716,-0.017,0.609,0.016,0.492,0.031,0.411,0.031,0.335,0.022,0.238,-0.004,0.161,-0.046,0.103,-0.098,0.075,-0.139,0.056,-0.183,0.044,-0.228,0.041,-0.3,0.048,-0.346,0.072,-0.407,0.109,-0.456,0.14,-0.481,0.193,-0.503,0.232,-0.508,0.27,-0.505,0.304,-0.494,0.335,-0.477,0.369,-0.439,0.383,-0.405,0.388,-0.364,0.384,-0.317,0.372,-0.278,0.354,-0.246,0.333,-0.222,0.311,-0.204,0.25,-0.171,0.24,-0.159,0.236,-0.144,0.238,-0.133,0.249,-0.114,0.285,-0.09,0.338,-0.075,0.38,-0.072,0.445,-0.079,0.504,-0.099,0.557,-0.13,0.625,-0.194,0.663,-0.244,0.709,-0.329,0.742,-0.419,0.761,-0.507,0.768,-0.588,0.765,-0.633,0.757,-0.674,0.742,-0.71,0.721,-0.741,0.692,-0.765,0.675,-0.774,0.634,-0.787,0.584,-0.792,0.534,-0.787,0.488,-0.775,0.449,-0.756,0.415,-0.734,0.315,-0.647,0.288,-0.634,0.268,-0.632,0.245,-0.635,0.226,-0.645,0.208,-0.67,0.205,-0.708,0.22,-0.768},\n    },\n  },\n  tuplet6 = {\n    x1 = 0.04, y1 = -1.499, x2 = 1.255, y2 = 0.032,\n    fill = {\n      {1.101,-0.371,1.072,-0.3,1.016,-0.208,0.945,-0.13,0.862,-0.068,0.803,-0.035,0.74,-0.008,0.643,0.019,0.577,0.029,0.512,0.032,0.394,0.023,0.326,0.007,0.266,-0.017,0.19,-0.064,0.148,-0.104,0.114,-0.149,0.087,-0.2,0.066,-0.255,0.051,-0.314,0.043,-0.377,0.04,-0.444,0.043,-0.513,0.044,-0.523,0.386,-0.523,0.377,-0.502,0.359,-0.44,0.345,-0.367,0.337,-0.297,0.336,-0.248,0.345,-0.191,0.365,-0.14,0.387,-0.112,0.416,-0.091,0.454,-0.077,0.5,-0.072,0.542,-0.078,0.584,-0.094,0.643,-0.136,0.696,-0.197,0.728,-0.247,0.767,-0.334,0.786,-0.399,0.804,-0.505,0.805,-0.523,1.13,-0.523,1.12,-0.448},\n      {0.748,-1.345,0.677,-1.288,0.613,-1.217,0.557,-1.136,0.494,-1.016,0.444,-0.892,0.439,-0.871,0.437,-0.842,0.446,-0.827,0.453,-0.823,0.471,-0.825,0.546,-0.87,0.603,-0.894,0.686,-0.914,0.776,-0.92,0.842,-0.916,0.902,-0.903,0.955,-0.882,1.022,-0.838,1.058,-0.801,1.099,-0.735,1.117,-0.686,1.131,-0.604,1.131,-0.532,1.12,-0.448,1.101,-0.371,1.081,-0.323,0.762,-0.323,0.767,-0.334,0.786,-0.399,0.804,-0.505,0.808,-0.58,0.804,-0.645,0.789,-0.699,0.762,-0.74,0.736,-0.76,0.682,-0.775,0.638,-0.775,0.595,-0.764,0.553,-0.745,0.514,-0.716,0.477,-0.68,0.428,-0.613,0.4,-0.56,0.377,-0.502,0.359,-0.44,0.345,-0.367,0.34,-0.323,0.05,-0.323,0.043,-0.377,0.04,-0.444,0.043,-0.513,0.064,-0.659,0.112,-0.836,0.165,-0.976,0.205,-1.06,0.273,-1.172,0.349,-1.267,0.434,-1.347,0.525,-1.409,0.623,-1.456,0.728,-1.486,0.838,-1.499,0.944,-1.496,1.006,-1.486,1.062,-1.47,1.134,-1.434,1.173,-1.404,1.205,-1.369,1.23,-1.33,1.246,-1.287,1.255,-1.24,1.255,-1.191,1.248,-1.145,1.234,-1.104,1.214,-1.068,1.173,-1.027,1.121,-1.001,1.081,-0.993,1.041,-0.993,1.005,-1,0.972,-1.013,0.943,-1.032,0.919,-1.057,0.902,-1.088,0.893,-1.124,0.893,-1.164,0.907,-1.22,0.923,-1.251,0.958,-1.289,0.985,-1.308,1.04,-1.336,1.054,-1.349,1.056,-1.356,1.054,-1.363,1.042,-1.376,1.005,-1.391,0.952,-1.399,0.886,-1.397,0.828,-1.383},\n    },\n  },\n  tuplet7 = {\n    x1 = 0.12, y1 = -1.488, x2 = 1.332, y2 = 0.016,\n    fill = {\n      {0.264,-1.428,0.277,-1.452,0.302,-1.471,0.323,-1.476,0.358,-1.474,0.374,-1.467,0.384,-1.456,0.387,-1.428,0.372,-1.36,0.377,-1.347,0.384,-1.344,0.399,-1.353,0.466,-1.413,0.532,-1.455,0.605,-1.481,0.664,-1.488,0.725,-1.482,0.779,-1.467,0.849,-1.433,0.986,-1.345,1.026,-1.33,1.068,-1.324,1.113,-1.331,1.149,-1.353,1.177,-1.39,1.203,-1.447,1.224,-1.467,1.257,-1.476,1.295,-1.474,1.314,-1.468,1.327,-1.454,1.332,-1.432,1.33,-1.406,1.312,-1.335,1.259,-1.198,1.197,-1.077,1.146,-0.994,1.093,-0.919,0.91,-0.695,0.863,-0.63,0.822,-0.567,0.77,-0.472,0.728,-0.378,0.693,-0.284,0.656,-0.158,0.619,-0.009,0.61,0.004,0.595,0.013,0.572,0.016,0.54,0.013,0.448,-0.013,0.4,-0.02,0.353,-0.014,0.246,0.013,0.206,0.015,0.187,0.005,0.181,-0.008,0.18,-0.024,0.221,-0.147,0.277,-0.271,0.345,-0.391,0.427,-0.505,0.498,-0.588,0.577,-0.666,0.634,-0.716,0.876,-0.908,0.96,-0.983,1.019,-1.045,1.074,-1.115,1.097,-1.149,1.097,-1.171,1.087,-1.179,1.07,-1.177,1.004,-1.14,0.926,-1.11,0.868,-1.096,0.812,-1.092,0.71,-1.103,0.481,-1.162,0.44,-1.167,0.4,-1.167,0.382,-1.163,0.349,-1.149,0.307,-1.113,0.275,-1.061,0.236,-0.963,0.217,-0.936,0.2,-0.928,0.18,-0.924,0.147,-0.926,0.132,-0.933,0.123,-0.946,0.12,-0.964},\n    },\n  },\n  tuplet8 = {\n    x1 = 0.041, y1 = -1.499, x2 = 1.292, y2 = 0.032,\n    fill = {\n      {1.124,-0.327,1.105,-0.266,1.059,-0.185,0.996,-0.117,0.918,-0.061,0.859,-0.03,0.795,-0.006,0.692,0.02,0.619,0.029,0.544,0.032,0.418,0.024,0.344,0.009,0.279,-0.011,0.222,-0.038,0.173,-0.07,0.131,-0.107,0.098,-0.148,0.072,-0.193,0.054,-0.242,0.044,-0.294,0.041,-0.373,0.051,-0.444,0.057,-0.462,0.323,-0.462,0.305,-0.414,0.294,-0.353,0.293,-0.296,0.302,-0.236,0.325,-0.179,0.348,-0.145,0.379,-0.115,0.418,-0.091,0.465,-0.074,0.521,-0.065,0.577,-0.065,0.648,-0.078,0.691,-0.095,0.73,-0.118,0.763,-0.148,0.79,-0.184,0.811,-0.225,0.824,-0.272,0.828,-0.324,0.823,-0.371,0.804,-0.415,0.783,-0.444,0.765,-0.462,1.134,-0.462,1.135,-0.393},\n      {1.286,-1.103,1.268,-1.042,1.236,-0.982,1.189,-0.923,1.15,-0.887,1.103,-0.852,1.013,-0.799,0.999,-0.786,0.993,-0.774,0.993,-0.762,1,-0.748,1.059,-0.68,1.091,-0.629,1.114,-0.576,1.125,-0.537,1.134,-0.474,1.135,-0.393,1.124,-0.327,1.105,-0.266,1.102,-0.262,0.821,-0.262,0.824,-0.272,0.828,-0.324,0.823,-0.371,0.804,-0.415,0.783,-0.444,0.735,-0.493,0.664,-0.553,0.532,-0.654,0.504,-0.66,0.476,-0.648,0.432,-0.616,0.394,-0.58,0.363,-0.54,0.328,-0.477,0.305,-0.414,0.294,-0.353,0.293,-0.296,0.298,-0.262,0.05,-0.262,0.044,-0.294,0.041,-0.373,0.051,-0.444,0.065,-0.491,0.099,-0.557,0.13,-0.598,0.168,-0.636,0.213,-0.671,0.267,-0.704,0.366,-0.75,0.387,-0.771,0.382,-0.797,0.338,-0.857,0.32,-0.889,0.306,-0.923,0.291,-0.98,0.284,-1.042,0.285,-1.098,0.294,-1.162,0.313,-1.221,0.324,-1.244,0.601,-1.244,0.596,-1.224,0.592,-1.176,0.598,-1.124,0.61,-1.092,0.629,-1.06,0.656,-1.027,0.713,-0.974,0.792,-0.912,0.82,-0.894,0.852,-0.884,0.87,-0.887,0.888,-0.896,0.926,-0.926,0.958,-0.959,0.996,-1.013,1.015,-1.051,1.035,-1.111,1.042,-1.151,1.043,-1.212,1.039,-1.244,1.281,-1.244,1.288,-1.216,1.292,-1.164},\n      {1.039,-1.476,1.101,-1.454,1.176,-1.41,1.215,-1.373,1.246,-1.333,1.269,-1.288,1.288,-1.216,1.292,-1.164,1.286,-1.103,1.268,-1.044,1.012,-1.044,1.015,-1.051,1.035,-1.111,1.042,-1.151,1.043,-1.212,1.038,-1.252,1.027,-1.289,1.01,-1.323,0.985,-1.353,0.953,-1.377,0.913,-1.394,0.864,-1.403,0.787,-1.401,0.742,-1.39,0.684,-1.363,0.653,-1.337,0.627,-1.305,0.608,-1.267,0.596,-1.224,0.592,-1.176,0.598,-1.124,0.61,-1.092,0.629,-1.06,0.642,-1.044,0.284,-1.044,0.285,-1.098,0.294,-1.162,0.313,-1.221,0.339,-1.275,0.394,-1.345,0.44,-1.385,0.521,-1.435,0.616,-1.471,0.687,-1.487,0.803,-1.499,0.888,-1.499,0.968,-1.491},\n    },\n  },\n  tuplet9 = {\n    x1 = 0.041, y1 = -1.5, x2 = 1.256, y2 = 0.031,\n    fill = {\n      {0.548,-0.123,0.619,-0.18,0.683,-0.251,0.739,-0.332,0.802,-0.452,0.852,-0.576,0.857,-0.597,0.859,-0.626,0.851,-0.641,0.843,-0.645,0.825,-0.643,0.75,-0.598,0.693,-0.574,0.61,-0.554,0.52,-0.548,0.454,-0.552,0.394,-0.565,0.341,-0.586,0.274,-0.63,0.238,-0.667,0.197,-0.733,0.179,-0.782,0.165,-0.864,0.165,-0.936,0.176,-1.02,0.195,-1.097,0.215,-1.145,0.534,-1.145,0.529,-1.134,0.51,-1.069,0.492,-0.963,0.488,-0.888,0.492,-0.823,0.507,-0.769,0.534,-0.728,0.56,-0.708,0.614,-0.693,0.658,-0.693,0.701,-0.704,0.743,-0.723,0.782,-0.752,0.819,-0.788,0.868,-0.855,0.896,-0.908,0.919,-0.966,0.937,-1.028,0.951,-1.101,0.956,-1.145,1.246,-1.145,1.253,-1.091,1.256,-1.024,1.253,-0.955,1.232,-0.809,1.184,-0.632,1.131,-0.492,1.091,-0.408,1.023,-0.296,0.947,-0.201,0.862,-0.121,0.771,-0.059,0.673,-0.012,0.568,0.018,0.458,0.031,0.352,0.028,0.29,0.018,0.234,0.002,0.162,-0.034,0.123,-0.064,0.091,-0.099,0.066,-0.138,0.05,-0.181,0.041,-0.228,0.041,-0.277,0.048,-0.323,0.062,-0.364,0.082,-0.4,0.123,-0.441,0.175,-0.467,0.215,-0.475,0.255,-0.475,0.291,-0.468,0.324,-0.455,0.353,-0.436,0.377,-0.411,0.394,-0.38,0.403,-0.344,0.403,-0.304,0.389,-0.248,0.372,-0.217,0.338,-0.179,0.311,-0.16,0.256,-0.132,0.242,-0.119,0.24,-0.112,0.242,-0.105,0.254,-0.092,0.291,-0.077,0.344,-0.069,0.41,-0.071,0.468,-0.085},\n      {0.195,-1.097,0.224,-1.168,0.28,-1.26,0.351,-1.338,0.434,-1.4,0.493,-1.433,0.556,-1.46,0.653,-1.487,0.719,-1.497,0.784,-1.5,0.902,-1.491,0.97,-1.475,1.03,-1.451,1.106,-1.404,1.147,-1.364,1.182,-1.319,1.209,-1.268,1.23,-1.213,1.245,-1.154,1.253,-1.091,1.256,-1.024,1.253,-0.955,1.252,-0.945,0.91,-0.945,0.919,-0.966,0.937,-1.028,0.951,-1.101,0.959,-1.171,0.96,-1.22,0.951,-1.277,0.931,-1.328,0.909,-1.356,0.88,-1.377,0.842,-1.391,0.796,-1.396,0.754,-1.39,0.712,-1.374,0.653,-1.332,0.6,-1.271,0.568,-1.221,0.529,-1.134,0.51,-1.069,0.492,-0.963,0.491,-0.945,0.166,-0.945,0.176,-1.02},\n    },\n  },\n}\n", "notation/sb_notate.lua": "--[[\n * sb_notate.lua - turns a block into an engraved page.\n *\n * Pure. No `reaper.`, no `ImGui.`, and no drawing: it decides what is on the\n * page and where, in units of a staff space, and `sb_draw.lua` puts ink on it.\n * That split is what makes the engraving testable - a beam group, a stem\n * direction or an accidental is a value this file returns, not a line someone\n * has to look at.\n *\n * The conventions it follows are the ordinary ones, and where there was a\n * choice to make they are Gehrkens, *Music Notation and Terminology* (1914),\n * cited by section: stems (Sec. 2), beamed groups (Sec. 4), rests (Sec. 5),\n * dots (Sec. 11), accidentals lasting to the bar (Sec. 24) and across a tie\n * (Sec. 25), and the whole rest as a measure rest (Sec. 33).\n--]]\n\nlocal M = {}\n\n-- The engine's PPQ, so a block's beats land on whole ticks and the arithmetic\n-- below can be integer. 960 divides by 64ths (60) and by triplets of them\n-- (40), which is the smallest thing any panel can ask for.\nM.TPQ = 960\n\nlocal LETTER_PC = { 0, 2, 4, 5, 7, 9, 11 }          -- C D E F G A B\nlocal LETTERS   = { \"C\", \"D\", \"E\", \"F\", \"G\", \"A\", \"B\" }\n\n-- Where a staff's bottom line sits, as a diatonic step. A step is\n-- `octave * 7 + letter`, so middle C is 28 and every step is one staff degree:\n-- the whole point of counting this way is that a line or a space is one step,\n-- whatever accidental the note is wearing.\nM.CLEFS = {\n  treble = { bottom = 30 },    -- E4\n  bass   = { bottom = 18 },    -- G2\n  perc   = { bottom = 0  },    -- positions come from the kit, not from pitch\n}\n\nM.MIDDLE_C = 28\n\n------------------------------------------------------------------------------\n-- Key signature and spelling\n------------------------------------------------------------------------------\n\n-- The order the accidentals are written in, as letter indices.\nlocal SHARP_ORDER = { 3, 0, 4, 1, 5, 2, 6 }         -- F C G D A E B\nlocal FLAT_ORDER  = { 6, 2, 5, 1, 4, 0, 3 }         -- B E A D G C F\n\n-- Which letter each pitch class takes when nothing else decides. Two tables,\n-- because a sharp key and a flat key disagree about all five black notes.\nlocal SHARP_SPELL = { [0]={0,0}, [1]={0,1}, [2]={1,0}, [3]={1,1}, [4]={2,0},\n                      [5]={3,0}, [6]={3,1}, [7]={4,0}, [8]={4,1}, [9]={5,0},\n                      [10]={5,1}, [11]={6,0} }\nlocal FLAT_SPELL  = { [0]={0,0}, [1]={1,-1}, [2]={1,0}, [3]={2,-1}, [4]={2,0},\n                      [5]={3,0}, [6]={4,-1}, [7]={4,0}, [8]={5,-1}, [9]={5,0},\n                      [10]={6,-1}, [11]={6,0} }\n\n-- The accidental a signature of `count` sharps or flats puts on each letter.\nfunction M.signatureMap(sig)\n  local map = {}\n  for i = 0, 6 do map[i] = 0 end\n  local order = (sig.kind == \"flat\") and FLAT_ORDER or SHARP_ORDER\n  local acc   = (sig.kind == \"flat\") and -1 or 1\n  for i = 1, math.min(sig.count, 7) do map[order[i]] = acc end\n  return map\nend\n\n-- Which key signature to print, scored rather than looked up.\n--\n-- A lookup table would answer for the major and minor keys and have nothing to\n-- say about the other fourteen scales here, several of which cannot be written\n-- as a signature at all: harmonic minor's seventh is an accidental in every\n-- edition ever printed, and the diminished scales spell two of their notes on\n-- one letter, so no signature can hold them. Scoring each of the fifteen\n-- candidates against what the scale actually spells picks the right one in the\n-- cases a table would have covered, and picks a sane one in the cases it\n-- would not: the signature that leaves the fewest accidentals on the page.\n--\n-- `spelled` is a list of { letter, acc } - the scale's own notes.\nfunction M.chooseSignature(spelled, tonicAcc)\n  local best\n  for count = 0, 7 do\n    for _, kind in ipairs({ \"sharp\", \"flat\" }) do\n      if not (count == 0 and kind == \"flat\") then      -- 0 sharps is 0 flats\n        local sig = { count = count, kind = kind }\n        local map, score = M.signatureMap(sig), 0\n        for _, n in ipairs(spelled) do\n          if map[n.letter] == n.acc then score = score + 1\n          else score = score - 1 end\n        end\n        -- Ties go to the smaller signature, and then to the one that leans the\n        -- way the tonic does, so C# major is seven sharps and Db major is five\n        -- flats rather than whichever was tried first.\n        local better = (not best) or score > best.score\n          or (score == best.score and count < best.count)\n          or (score == best.score and count == best.count\n              and tonicAcc and tonicAcc < 0 and kind == \"flat\")\n        if better then best = { count = count, kind = kind, score = score } end\n      end\n    end\n  end\n  return { count = best.count, kind = best.kind }\nend\n\n-- Everything the engraver needs to know about the key, read off the engine's\n-- own tables so the notation agrees with the note names the window prints.\n-- `E` is sb_engine; nothing else in this file knows it exists.\nfunction M.context(E, st)\n  local sc      = E.SCALES[st.scale]\n  local spelled = {}\n  local spell   = {}                                   -- pitch class -> letter, acc\n\n  for d = 0, #sc.iv - 1 do\n    local letter = (E.ROOTS[st.root].letter + sc.letters[d + 1]) % 7\n    local pc     = E.scalePitch(st, d) % 12\n    local acc    = pc - LETTER_PC[letter + 1]\n    if acc >  6 then acc = acc - 12 end\n    if acc < -6 then acc = acc + 12 end\n    spelled[#spelled + 1] = { letter = letter, acc = acc }\n    -- A scale that spells two notes on one letter keeps the first: the blues\n    -- and diminished scales do this, and the lower of the pair is the one the\n    -- ear hears as the degree.\n    if not spell[pc] then spell[pc] = { letter = letter, acc = acc } end\n  end\n\n  local sig = M.chooseSignature(spelled, E.ROOTS[st.root].acc)\n  return { spell = spell, sig = sig, sigMap = M.signatureMap(sig) }\nend\n\n-- A MIDI pitch as a written note: which staff degree, and what accidental it\n-- is wearing. The key's own spelling first, so F# major's seventh is E# here\n-- as it is everywhere else in the app; anything chromatic falls back to the\n-- side the signature leans.\nfunction M.spell(pitch, ctx)\n  local pc = pitch % 12\n  local e  = ctx.spell and ctx.spell[pc]\n  local letter, acc\n  if e then\n    letter, acc = e.letter, e.acc\n  else\n    local t = (ctx.sig.kind == \"flat\" and ctx.sig.count > 0)\n              and FLAT_SPELL[pc] or SHARP_SPELL[pc]\n    letter, acc = t[1], t[2]\n  end\n  -- The written octave follows the letter, not the sounding pitch, or Cb4\n  -- would be filed an octave below the C it is written on.\n  local oct = math.floor((pitch - acc) / 12) - 1\n  return { step = oct * 7 + letter, letter = letter, acc = acc, oct = oct }\nend\n\nfunction M.stepName(step)\n  return LETTERS[step % 7 + 1] .. tostring(math.floor(step / 7))\nend\n\n------------------------------------------------------------------------------\n-- Note values\n------------------------------------------------------------------------------\n\n-- Every value a note can be written as, in ticks. Built rather than typed so\n-- that the triplet and the dotted forms cannot drift out of step with the\n-- plain ones.\nlocal VALUES, BY_TICKS = {}, {}\ndo\n  local DOT = { 1, 1.5, 1.75 }\n  for _, den in ipairs({ 1, 2, 4, 8, 16, 32, 64 }) do\n    for dots = 0, 2 do\n      for _, tup in ipairs({ 1, 3 }) do\n        local t = 4 * M.TPQ / den * DOT[dots + 1] * (tup == 3 and 2 / 3 or 1)\n        -- A dotted triplet is a thing that exists and a thing nothing here can\n        -- generate, and leaving it in the set let the fallback below reach for\n        -- a double-dotted triplet sixteenth in place of a plain one.\n        if tup == 3 and dots > 0 then t = 0 end\n        if t == math.floor(t) and t > 0 then\n          local v = { ticks = t, den = den, dots = dots,\n                      tuplet = (tup == 3) and 3 or nil }\n          VALUES[#VALUES + 1] = v\n          -- Two spellings of one duration go to the plainer of the two: a\n          -- dotted crotchet is never a triplet minim on the page.\n          local old = BY_TICKS[t]\n          local rank = (v.tuplet and 4 or 0) + dots\n          if not old or rank < old.rank then\n            BY_TICKS[t] = { v = v, rank = rank }\n          end\n        end\n      end\n    end\n  end\n  table.sort(VALUES, function(a, b)\n    if a.ticks ~= b.ticks then return a.ticks > b.ticks end\n    if (a.tuplet ~= nil) ~= (b.tuplet ~= nil) then return a.tuplet == nil end\n    return a.dots < b.dots\n  end)\nend\n\nM.VALUES = VALUES\n\nfunction M.value(ticks)\n  local e = BY_TICKS[ticks]\n  return e and e.v or nil\nend\n\n-- The value closest to a duration that has none of its own. Used as a last\n-- resort, where writing something a reader can count beats writing something\n-- exact that no symbol exists for.\nfunction M.nearestValue(ticks)\n  local best, gap\n  for _, v in ipairs(VALUES) do\n    local d = math.abs(v.ticks - ticks)\n    if not gap or d < gap then best, gap = v, d end\n  end\n  return best\nend\n\n-- How many hooks or beams a value carries: an eighth one, a sixteenth two.\nfunction M.hooks(v)\n  if v.den <= 4 then return 0 end\n  local n, den = 0, 4\n  while den < v.den do den, n = den * 2, n + 1 end\n  return n\nend\n\n-- The coarsest value that divides an onset, which is as much note as that\n-- onset can carry without the beat underneath it going missing.\nlocal function alignment(pos, cap)\n  if pos == 0 then return cap end\n  for _, v in ipairs(VALUES) do\n    if v.ticks <= cap and pos % v.ticks == 0 then return v.ticks end\n  end\n  return 1\nend\n\n-- One duration as the notes it is actually written with, in order, tied.\n--\n-- Nearly always that is one note: everything the panels can ask for is a rate\n-- times a count, so the duration is a value the notation already has a symbol\n-- for, and a symbol that exists is the one to use wherever it falls. A half\n-- note on the second beat of a three-four bar is written as a half note, and a\n-- rule that split it at the beat because the beat divides the bar would be\n-- wrong about a bar of printed music.\n--\n-- Only a duration with no symbol of its own is decomposed, and then by the\n-- ordinary rule: the longest value that fits and that the onset can carry.\n-- Counting the position rather than accumulating lengths keeps a long tie\n-- chain from drifting.\nfunction M.split(pos, ticks, barTicks)\n  if ticks <= 0 then return nil end\n  local single = M.value(ticks)\n  if single then return { single } end\n\n  local out, p, left = {}, pos, ticks\n  local guard = 0\n  while left > 0 do\n    guard = guard + 1\n    if guard > 16 then return nil end                 -- pathological; caller rests it\n    local align = alignment(p % barTicks, barTicks)\n    local took\n    for _, v in ipairs(VALUES) do\n      if v.ticks <= left and v.ticks <= align then took = v; break end\n    end\n    -- Nothing the onset can carry is also short enough to fit. Take the\n    -- longest that fits at all rather than stalling; the tie still adds up.\n    if not took then\n      for _, v in ipairs(VALUES) do\n        if v.ticks <= left then took = v; break end\n      end\n    end\n    if not took then return nil end                   -- shorter than a 64th\n    out[#out + 1] = took\n    p, left = p + took.ticks, left - took.ticks\n  end\n  return out\nend\n\n-- The grid a block was laid out on: its own rate, which is what its onsets are\n-- multiples of. The engraver snaps to this, so anything pushed off the grid -\n-- a shuffle, when there was a drum block to have one - comes back onto the\n-- beat, and everything else is left exactly where it was.\nfunction M.gridFor(E, st)\n  if st.cat == \"Chord\"  then return E.chopBeats(st) end\n  return E.rateBeats(st)\nend\n\n------------------------------------------------------------------------------\n-- The kit\n------------------------------------------------------------------------------\n\n-- Where each piece is written on the percussion staff, in half-spaces above\n-- the bottom line, and with what head. The app plays one piece at a time, so\n-- these only have to be recognisable rather than to avoid each other.\nM.DRUM_MAP = {\n  [36] = { pos = 1,  head = \"normal\" },   -- Kick, first space\n  [41] = { pos = 3,  head = \"normal\" },   -- Low tom\n  [38] = { pos = 5,  head = \"normal\" },   -- Snare, third space\n  [47] = { pos = 7,  head = \"normal\" },   -- Mid tom\n  [50] = { pos = 9,  head = \"normal\" },   -- High tom, above the staff\n  [51] = { pos = 8,  head = \"cross\"  },   -- Ride, top line\n  [42] = { pos = 10, head = \"cross\"  },   -- Closed hi-hat\n  [46] = { pos = 10, head = \"open\"   },   -- Open hi-hat, ringed\n  [49] = { pos = 11, head = \"cross\"  },   -- Crash\n}\n\n------------------------------------------------------------------------------\n-- Laying the block out\n------------------------------------------------------------------------------\n\nlocal EPS = 1e-6\n\nlocal function tick(beats) return math.floor(beats * M.TPQ + 0.5) end\n\n-- Notes that begin together are one chord. Everything this app generates is a\n-- single voice, so an onset is an event and there is nothing to untangle.\n--\n-- How long each one is *written* is not how long it sounds. Every block leaves\n-- here gated - a chord set to fill a bar sounds nine tenths of it and stops,\n-- so the player hears the change - and notating that literally would put a\n-- 63/64ths-and-a-rest where a whole note belongs. What the notation wants is\n-- the note's share of the bar, which is the distance to whatever starts next.\n-- The gate is a property of the MIDI, and the MIDI is still exported gated.\nlocal function events(notes, total, capTicks, gridTicks, restTicks)\n  local by, order = {}, {}\n  local taken = {}\n  local raw = {}\n  for _, n in ipairs(notes) do raw[#raw + 1] = n end\n  table.sort(raw, function(a, b) return a.start < b.start end)\n\n  for _, n in ipairs(raw) do\n    local t = tick(n.start)\n    -- A shuffle pushes every second hit off the grid on purpose, and no note\n    -- value can say \"a third of the way to the next one\". Printed music writes\n    -- a shuffle straight and names it at the top, which is exactly what the\n    -- block's own name already does - \"Kick 1/16 shuffle 40\" - so the onsets\n    -- go back on the grid here and the name carries the swing.\n    if gridTicks and gridTicks > 0 then\n      local snapped = math.floor(t / gridTicks + 0.5) * gridTicks\n      -- The offset is never a whole step, so two hits cannot legitimately\n      -- land on one: if they do, keep them apart rather than losing one.\n      if taken[snapped] and not by[t] then snapped = snapped + gridTicks end\n      taken[snapped] = true\n      t = snapped\n    end\n    if t < total then\n      if not by[t] then by[t] = { at = t, notes = {} }; order[#order + 1] = t end\n      local e = by[t]\n      e.notes[#e.notes + 1] = n\n    end\n  end\n  table.sort(order)\n  local out = {}\n  for i, t in ipairs(order) do\n    local e = by[t]\n    local nextAt = order[i + 1] or total\n    e.dur = math.max(nextAt - t, 1)\n    -- A drum does not sustain, so a lone crash in an eight-bar block is a hit\n    -- and then silence rather than eight bars of tied whole notes.\n    if capTicks then e.dur = math.min(e.dur, capTicks) end\n    -- Notes that are as played rather than gated (another app's part, opts.rests)\n    -- keep their silences (0019): where the sound stops, rounded up to the rest\n    -- grid, and a rest only when at least one step of that grid is left before\n    -- the next onset. Rounding up is what keeps articulation out of it: a note\n    -- sounding nine tenths of its slot reaches the slot's end.\n    if restTicks and not capTicks then\n      local sounds = 0\n      for _, n in ipairs(e.notes) do sounds = math.max(sounds, tick(n.len or 0)) end\n      local stop = math.ceil((t + sounds) / restTicks) * restTicks\n      if stop <= t then stop = t + restTicks end\n      if nextAt - stop >= restTicks then e.dur = stop - t end\n    end\n    out[#out + 1] = e\n  end\n  return out\nend\n\n-- Treble, bass, or both. A block that stays on one side of middle C gets one\n-- staff, which is most of them; a chord that straddles it gets the great\n-- staff. Deciding once for the whole block rather than note by note keeps a\n-- run from hopping staves in the middle of itself.\nlocal function chooseStaves(evts, ctx, drums)\n  if drums then return { { clef = \"perc\" } }, function(n) return 1 end end\n\n  local lo, hi = 200, -1\n  for _, e in ipairs(evts) do\n    for _, n in ipairs(e.notes) do\n      lo, hi = math.min(lo, n.pitch), math.max(hi, n.pitch)\n    end\n  end\n  if hi < 0 then return { { clef = \"treble\" } }, function() return 1 end end\n\n  if lo >= 60 then return { { clef = \"treble\" } }, function() return 1 end end\n  -- A block that sits just under middle C is a bass staff on its own rather\n  -- than a great staff with an empty top half.\n  if hi < 60 then return { { clef = \"bass\" } }, function() return 1 end end\n  return { { clef = \"treble\" }, { clef = \"bass\" } },\n         function(n) return n.pitch >= 60 and 1 or 2 end\nend\n\n-- The metric group beams are gathered inside: a quarter note, or the dotted\n-- quarter of a compound signature.\nlocal function beamGroup(tsNum, tsDen)\n  if tsDen == 8 and tsNum % 3 == 0 then return M.TPQ * 3 / 2 end\n  return M.TPQ\nend\n\n-- `block` is what sb_engine.generate returns. `opts` carries the bar, the\n-- signature, the key context, and whether this is the kit; `opts.rests` says\n-- the notes are as played rather than gated, so a silence of a sixteenth\n-- (`opts.restGrid`, in beats) or more is written as a rest (0019).\nfunction M.layout(block, opts)\n  opts = opts or {}\n  local ctx      = opts.ctx or { sig = { count = 0, kind = \"sharp\" },\n                                 sigMap = M.signatureMap({ count = 0, kind = \"sharp\" }) }\n  local tsNum    = opts.tsNum or 4\n  local tsDen    = opts.tsDen or 4\n  local barTicks = math.max(tick(opts.barBeats or 4), M.TPQ / 4)\n  local drums    = opts.drums or false\n\n  local doc = {\n    sig    = ctx.sig,\n    time   = { num = tsNum, den = tsDen },\n    totalTicks = 0,\n    drums  = drums,\n    name   = block and block.name or \"\",\n    staves = nil,\n    measures = {},\n  }\n\n  local total = math.max(tick((block and block.beats) or 0), 1)\n  local bars  = math.max(1, math.ceil((total - EPS) / barTicks))\n\n  local grid = opts.grid and tick(opts.grid) or nil\n  local rests = opts.rests and tick(opts.restGrid or 0.25) or nil\n  local evts = block and events(block.notes, total, drums and barTicks or nil, grid, rests) or {}\n  local assign\n  doc.staves, assign = chooseStaves(evts, ctx, drums)\n\n  -- Every event, cut at the bar lines and turned into written values. A note\n  -- that crosses a bar becomes two notes and a tie (Sec. 25).\n  local perBar = {}\n  for i = 1, bars do perBar[i] = {} end\n\n  for _, e in ipairs(evts) do\n    local at, left = e.at, e.dur\n    local firstPiece = true\n    while left > 0 do\n      local bar     = math.floor(at / barTicks)\n      if bar >= bars then break end\n      local barEnd  = (bar + 1) * barTicks\n      local chunk   = math.min(left, barEnd - at)\n      local pieces  = M.split(at, chunk, barTicks)\n      -- A duration no run of tied values can reach exactly is written as the\n      -- nearest one there is. This is the only place the page stops being a\n      -- faithful account of the MIDI, and it takes a deliberately odd block\n      -- to reach it.\n      if not pieces then pieces = { M.nearestValue(chunk) } end\n\n      local off = at - bar * barTicks\n      for i, v in ipairs(pieces) do\n        local last   = (i == #pieces) and (left - chunk <= 0)\n        local target = perBar[bar + 1]\n        target[#target + 1] = {\n          kind    = \"chord\",\n          at      = off,\n          ticks   = v.ticks,\n          value   = v,\n          notes   = e.notes,\n          tieIn   = not (firstPiece and i == 1),\n          tieOut  = not last,\n        }\n        off = off + v.ticks\n        firstPiece = false\n      end\n      at, left = at + chunk, left - chunk\n    end\n  end\n\n  ------------------------------------------------------------------------------\n  -- Measures\n  ------------------------------------------------------------------------------\n\n  local group = beamGroup(tsNum, tsDen)\n\n  for b = 1, bars do\n    local mBeats = math.min(barTicks, total - (b - 1) * barTicks)\n    local m = { index = b, ticks = barTicks, used = math.max(mBeats, 0), staves = {} }\n    for s = 1, #doc.staves do m.staves[s] = { elements = {} } end\n\n    -- Accidentals last to the bar (Sec. 24), and they are remembered per staff\n    -- degree, so a sharp on one octave's F says nothing about another's.\n    local sounding = {}\n\n    -- Sort this bar's pieces by onset, then split them across the staves.\n    local pieces = perBar[b]\n    table.sort(pieces, function(x, y) return x.at < y.at end)\n\n    local byStaff = {}\n    for s = 1, #doc.staves do byStaff[s] = {} end\n\n    for _, p in ipairs(pieces) do\n      local split = {}\n      for _, n in ipairs(p.notes) do\n        local s = assign(n)\n        split[s] = split[s] or {}\n        table.insert(split[s], n)\n      end\n      for s, ns in pairs(split) do\n        local heads = {}\n        for _, n in ipairs(ns) do\n          local head\n          if drums then\n            local d = M.DRUM_MAP[n.pitch] or { pos = 5, head = \"normal\" }\n            head = { pos = d.pos, glyph = d.head, pitch = n.pitch }\n          else\n            local sp  = M.spell(n.pitch, ctx)\n            local pos = sp.step - M.CLEFS[doc.staves[s].clef].bottom\n            local key = sp.step\n            local want = sp.acc\n            local have = sounding[key]\n            if have == nil then have = ctx.sigMap[sp.letter] or 0 end\n            head = { pos = pos, glyph = \"normal\", pitch = n.pitch,\n                     step = sp.step, name = M.stepName(sp.step) }\n            -- Show it when it changes what the degree is sounding, and hold it\n            -- until the bar line. A tie carries it further (Sec. 25), which is\n            -- why a tied-in piece never asks for one again.\n            if want ~= have and not p.tieIn then\n              head.acc = want\n              sounding[key] = want\n            elseif not p.tieIn then\n              sounding[key] = have\n            end\n          end\n          heads[#heads + 1] = head\n        end\n        table.sort(heads, function(x, y) return x.pos < y.pos end)\n        local el = {\n          kind   = \"chord\",\n          at     = p.at,\n          ticks  = p.ticks,\n          value  = p.value,\n          heads  = heads,\n          tieIn  = p.tieIn,\n          tieOut = p.tieOut,\n        }\n        local list = byStaff[s]\n        list[#list + 1] = el\n      end\n    end\n\n    -- Rests fill whatever the notes left. A bar with nothing in it at all is\n    -- one whole rest, whatever the signature says (Sec. 33).\n    for s = 1, #doc.staves do\n      local list = byStaff[s]\n      table.sort(list, function(x, y)\n        if x.at ~= y.at then return x.at < y.at end\n        return x.ticks < y.ticks\n      end)\n\n      local filled, out = {}, {}\n      for _, el in ipairs(list) do\n        out[#out + 1] = el\n        filled[#filled + 1] = { el.at, el.at + el.ticks }\n      end\n\n      local limit = m.used\n      if #list == 0 then\n        if limit > 0 then\n          out[#out + 1] = { kind = \"rest\", at = 0, ticks = limit,\n                            value = { den = 1, dots = 0 }, measureRest = true }\n        end\n      else\n        table.sort(filled, function(x, y) return x[1] < y[1] end)\n        local cursor = 0\n        local gaps = {}\n        for _, span in ipairs(filled) do\n          if span[1] > cursor + EPS then gaps[#gaps + 1] = { cursor, span[1] } end\n          cursor = math.max(cursor, span[2])\n        end\n        if limit > cursor + EPS then gaps[#gaps + 1] = { cursor, limit } end\n        for _, g in ipairs(gaps) do\n          local pieces2 = M.split(g[1], g[2] - g[1], barTicks)\n          if pieces2 then\n            local off = g[1]\n            for _, v in ipairs(pieces2) do\n              out[#out + 1] = { kind = \"rest\", at = off, ticks = v.ticks, value = v }\n              off = off + v.ticks\n            end\n          end\n        end\n      end\n\n      table.sort(out, function(x, y)\n        if x.at ~= y.at then return x.at < y.at end\n        return (x.kind == \"chord\" and 0 or 1) < (y.kind == \"chord\" and 0 or 1)\n      end)\n      m.staves[s].elements = out\n    end\n\n    -- Where each element falls in the block as a whole, which is what lets a\n    -- playhead find the note it is inside without searching for it.\n    for _, staff in ipairs(m.staves) do\n      for _, el in ipairs(staff.elements) do\n        el.abs = (b - 1) * barTicks + el.at\n      end\n    end\n\n    doc.measures[b] = m\n  end\n\n  doc.totalTicks = total\n\n  ------------------------------------------------------------------------------\n  -- Stems and beams\n  ------------------------------------------------------------------------------\n\n  for _, m in ipairs(doc.measures) do\n    for s, staff in ipairs(m.staves) do\n      M.beam(staff.elements, group, m.ticks)\n      staff.tuplets = M.tuplets(staff.elements)\n      M.stems(staff.elements, doc.staves[s].clef == \"perc\")\n      M.placeHeads(staff.elements)\n    end\n  end\n\n  M.space(doc, opts.width)\n  return doc\nend\n\n-- Eighths and shorter are gathered into groups inside one metric beat, all\n-- stems the same way (Sec. 4). A rest ends a group, and so does a beat.\nfunction M.beam(elements, group, barTicks)\n  local runs, cur = {}, nil\n  local function close()\n    if cur and #cur >= 2 then runs[#runs + 1] = cur end\n    if cur and #cur == 1 then cur[1].beam = nil end\n    cur = nil\n  end\n  for _, el in ipairs(elements) do\n    local flagged = el.kind == \"chord\" and M.hooks(el.value) > 0\n    if not flagged then\n      close()\n    else\n      local g = math.floor(el.at / group)\n      if cur and (cur.group ~= g or cur.endsAt ~= el.at) then close() end\n      if not cur then cur = { group = g, endsAt = el.at } end\n      cur[#cur + 1] = el\n      cur.endsAt = el.at + el.ticks\n      el.beam = cur\n    end\n  end\n  close()\n\n  for i, run in ipairs(runs) do\n    run.id = i\n    for _, el in ipairs(run) do\n      el.beam = run\n      el.beams = M.hooks(el.value)\n    end\n  end\n  return runs\nend\n\n-- The figure over a group of three. A beamed triplet needs only the number,\n-- because the beam already says where the group starts and stops; three\n-- triplet quarters have no beam to say it, so those get the bracket too.\nfunction M.tuplets(elements)\n  local groups, run = {}, {}\n  local function flush()\n    local i = 1\n    while i <= #run do\n      local g = { n = 3, elements = {} }\n      for k = i, math.min(i + 2, #run) do g.elements[#g.elements + 1] = run[k] end\n      -- A run that does not divide by three leaves a group short. The panels\n      -- can ask for exactly that - eight triplet eighths is a whole run of the\n      -- scale and two thirds of a third group - and the remainder is still\n      -- triplet-rate, so it keeps the figure and says so.\n      g.partial = #g.elements < 3\n      local beam, same = run[i].beam, true\n      for _, el in ipairs(g.elements) do\n        if el.beam ~= beam or not beam then same = false end\n      end\n      g.bracket = not same\n      g.beam = same and beam or nil\n      for _, el in ipairs(g.elements) do el.tuplet = g end\n      groups[#groups + 1] = g\n      i = i + 3\n    end\n    run = {}\n  end\n  for _, el in ipairs(elements) do\n    if el.kind == \"chord\" and el.value.tuplet == 3 then\n      run[#run + 1] = el\n    else\n      flush()\n    end\n  end\n  flush()\n  return groups\nend\n\n-- Below the middle line the stem turns up, above it turns down, and a chord is\n-- decided by whichever of its heads is furthest from that line (Sec. 2). A\n-- beamed group goes the way its majority does (Sec. 4).\nfunction M.stems(elements, perc)\n  local MIDDLE = 4\n\n  local function want(el)\n    local far, dir = 0, \"up\"\n    for _, h in ipairs(el.heads) do\n      local d = h.pos - MIDDLE\n      if math.abs(d) > math.abs(far) then far, dir = d, (d > 0) and \"down\" or \"up\" end\n    end\n    if far == 0 then return \"up\" end\n    return dir\n  end\n\n  local done = {}\n  for _, el in ipairs(elements) do\n    if el.kind == \"chord\" then\n      el.stem = (el.value.den >= 2) and want(el) or nil\n      if el.value.den == 1 then el.stem = nil end\n      if el.beam and not done[el.beam] then\n        done[el.beam] = true\n        local up = 0\n        for _, e in ipairs(el.beam) do\n          if want(e) == \"up\" then up = up + 1 else up = up - 1 end\n        end\n        el.beam.stem = (up >= 0) and \"up\" or \"down\"\n      end\n      if el.beam then el.stem = el.beam.stem end\n    end\n  end\nend\n\n------------------------------------------------------------------------------\n-- Heads and accidentals\n------------------------------------------------------------------------------\n\n-- Half a notehead, in spaces: Bravura's black head is 1.18 wide and its\n-- whole note 1.688 (sb_glyphs.lua). `sb_draw.lua` reads these rather than\n-- keeping its own copy: the layout cannot say where the accidental in front\n-- of a head goes without knowing how much room the head takes, and two\n-- numbers that have to agree should be one number.\nM.HEAD_RX  = 0.59\nM.WHOLE_RX = 0.844\n\n-- How wide each accidental's column is - Bravura's symbol and a little air -\n-- and the air between the block of them and the leftmost head.\nM.ACC_WIDTHS = { [-2] = 1.76, [-1] = 1.02, [0] = 0.80, [1] = 1.12, [2] = 1.10 }\nM.ACC_PAD    = 0.25\n\n-- How far apart two accidentals must be before they can share a column, in\n-- staff degrees. Bravura's sharp stands nearly two spaces and four fifths\n-- tall, which is between five and six of these, so a seventh apart is the\n-- rule and leaves a little air.\nM.ACC_CLEAR  = 7\n\n-- Which side of the stem each head sits on, and where each accidental goes.\n--\n-- This runs after `M.stems`, because both answers depend on which way the stem\n-- turned: a head pushed off a downward stem goes to the *left* of it, and the\n-- accidentals then have to clear a head that is a whole width further out than\n-- the rest. Not clearing it is what drew a sharp underneath a notehead.\nfunction M.placeHeads(elements)\n  for _, el in ipairs(elements) do\n    if el.kind == \"chord\" and el.heads then\n      local rx = (el.value.den <= 1) and M.WHOLE_RX or M.HEAD_RX\n\n      -- Which way a crossed head goes, decided **here and once**. A downward\n      -- stem puts it on the left, anything else on the right - and a whole\n      -- note, which has no stem at all, counts as anything else.\n      --\n      -- This used to be worked out twice, once here as `stem ~= \"down\"` and\n      -- once in the drawing as `stem == \"up\"`. Those agree about every note\n      -- with a stem and disagree about every note without one, so a whole-note\n      -- chord put its crossed head on the left while the accidentals were\n      -- placed as though it had gone right. That is how a sharp ended up\n      -- underneath a notehead.\n      el.sideDir = (el.stem == \"down\") and -1 or 1\n\n      -- Two heads a step apart cannot both sit on the same side of the stem,\n      -- so the upper of each such pair crosses it. This is the one thing that\n      -- makes a close-voiced chord readable rather than a blot.\n      local flip = false\n      for i, h in ipairs(el.heads) do\n        local prev = el.heads[i - 1]\n        flip = (prev ~= nil and math.abs(h.pos - prev.pos) == 1 and not flip)\n        h.side = flip and 1 or 0\n      end\n\n      -- How far left of the chord's own x the ink reaches.\n      local left = rx\n      for _, h in ipairs(el.heads) do\n        if h.side == 1 and el.sideDir < 0 then left = math.max(left, 3 * rx) end\n      end\n      el.headLeft = left\n\n      -- The accidentals, in columns working out from the heads. A column holds\n      -- as many as will fit without touching, so a chord with two of them far\n      -- apart keeps both in one column instead of marching off to the left.\n      -- Topmost first, which is the order that puts it nearest the chord.\n      local cols, used = {}, 0\n      for i = #el.heads, 1, -1 do\n        local h = el.heads[i]\n        h.accCol, h.accDX = nil, nil\n        if h.acc then\n          local c = 1\n          while true do\n            local clash = false\n            for _, p in ipairs(cols[c] or {}) do\n              if math.abs(p - h.pos) < M.ACC_CLEAR then clash = true; break end\n            end\n            if not clash then break end\n            c = c + 1\n          end\n          cols[c] = cols[c] or {}\n          cols[c][#cols[c] + 1] = h.pos\n          h.accCol = c\n          used = math.max(used, c)\n        end\n      end\n\n      -- Each column is as wide as its widest accidental, and every accidental\n      -- in it is centred on that width.\n      local at = left + M.ACC_PAD\n      local centre = {}\n      for c = 1, used do\n        local w = 0\n        for _, h in ipairs(el.heads) do\n          if h.accCol == c then w = math.max(w, M.ACC_WIDTHS[h.acc] or 0.8) end\n        end\n        centre[c] = at + w / 2\n        at = at + w\n      end\n      for _, h in ipairs(el.heads) do\n        if h.accCol then h.accDX = -centre[h.accCol] end\n      end\n      el.accWidth = (used > 0) and (at - left) or 0\n    end\n  end\nend\n\n------------------------------------------------------------------------------\n-- Spacing\n------------------------------------------------------------------------------\n\n-- Everything from here is measured in staff spaces, so the drawing code needs\n-- one number - how many pixels a space is - and nothing else.\nM.PAD_LEFT   = 1.2      -- inside a bar line, before the first note\nM.PAD_RIGHT  = 1.2\nM.MIN_GAP    = 2.2      -- between one onset and the next\nM.FLAG_GAP   = 2.7      -- the same after a flag, which reaches out to the right\nM.ACC_WIDTH  = 1.1\nM.CLEF_WIDTH = 4.0\nM.SIG_STEP   = 1.05\nM.TIME_WIDTH = 2.4\nM.TIME_FIGURE = 1.8     -- Bravura's widest time-signature figure, and a gap\n\n-- How much room a time signature takes: its widest row of figures with some\n-- air, and never less than a single figure needs. A REAPER project can be in\n-- twelve-eight, and two figures side by side are twice as wide as one.\nfunction M.timeWidth(time)\n  local n = math.max(#tostring(time and time.num or 4), #tostring(time and time.den or 4))\n  return math.max(M.TIME_WIDTH, n * M.TIME_FIGURE + 0.6)\nend\n\n-- How wide a duration wants to be. Proportional would make a whole note eight\n-- times a quarter and a page mostly air, so this is the usual compromise: the\n-- width grows with the square root of the duration.\nlocal function widthFor(ticks)\n  return M.MIN_GAP * math.sqrt(ticks / M.TPQ)\nend\n\nfunction M.space(doc, width)\n  -- What goes in front of the first measure of every system.\n  local head = M.CLEF_WIDTH + M.timeWidth(doc.time) + 0.8\n             + doc.sig.count * M.SIG_STEP + (doc.sig.count > 0 and 0.6 or 0)\n  doc.headWidth = head\n\n  for _, m in ipairs(doc.measures) do\n    -- One column per onset, shared by both staves so the great staff lines up.\n    local onsets, seen = {}, {}\n    for _, staff in ipairs(m.staves) do\n      for _, el in ipairs(staff.elements) do\n        if not seen[el.at] then seen[el.at] = true; onsets[#onsets + 1] = el.at end\n      end\n    end\n    table.sort(onsets)\n\n    local x, at = M.PAD_LEFT, {}\n    for i, o in ipairs(onsets) do\n      -- An accidental is written in front of the note, so the column has to\n      -- open far enough to the left to hold it - and a chord needing two\n      -- columns of them needs twice the room, which is why the element works\n      -- its own width out rather than being given a flat allowance here.\n      local acc = 0\n      for _, staff in ipairs(m.staves) do\n        for _, el in ipairs(staff.elements) do\n          if el.at == o then acc = math.max(acc, el.accWidth or 0) end\n        end\n      end\n      x = x + acc\n      at[o] = x\n      local nextAt = onsets[i + 1]\n      local span = nextAt and (nextAt - o) or (m.ticks - o)\n      -- A flag on an upward stem hangs out to the right over where the next\n      -- note would be, so a flagged note keeps its neighbour further off.\n      local least = M.MIN_GAP\n      for _, staff in ipairs(m.staves) do\n        for _, el in ipairs(staff.elements) do\n          if el.at == o and el.kind == \"chord\" and el.stem == \"up\" and not el.beam\n             and M.hooks(el.value) > 0 then\n            least = M.FLAG_GAP\n          end\n        end\n      end\n      x = x + math.max(widthFor(math.max(span, 1)), least)\n    end\n    m.width = math.max(x + M.PAD_RIGHT, 6)\n\n    for _, staff in ipairs(m.staves) do\n      for _, el in ipairs(staff.elements) do el.x = at[el.at] or M.PAD_LEFT end\n    end\n  end\n\n  -- Measures run across the page until they run out of room, then start a new\n  -- system. A measure wider than a whole system gets one to itself rather than\n  -- being dropped.\n  local avail = (width or 60) - head\n  local systems, cur, used = {}, nil, 0\n  for _, m in ipairs(doc.measures) do\n    if not cur or (used + m.width > avail and #cur > 0) then\n      cur = {}; systems[#systems + 1] = cur; used = 0\n    end\n    cur[#cur + 1] = m\n    used = used + m.width\n  end\n  -- Stretch each system's measures to fill the line, the way a printed page\n  -- does, so a system never stops halfway across with white to its right.\n  for _, sys in ipairs(systems) do\n    local w = 0\n    for _, m in ipairs(sys) do w = w + m.width end\n    sys.width = w\n    sys.scale = (w > 0 and avail > 0 and #systems > 1) and math.max(1, avail / w) or 1\n    if sys == systems[#systems] and #systems > 1 then sys.scale = 1 end\n  end\n  doc.systems = systems\n  return doc\nend\n\nreturn M\n", "starting-blocks/sb_engine.lua": "--[[ Starting Blocks - the music.\n\n     Pure Lua. Nothing in this file touches REAPER or ImGui, which is the\n     point: the generators are the part that has to be right, and here they can\n     be run and checked by tests/test_engine.lua rather than only by reading.\n\n     Scale degrees are 0-based throughout - degree 0 is the tonic - because the\n     arithmetic wants them that way (degree + 2 is the third above, and the\n     octave falls out of the division). Table indices are 1-based, like Lua.\n]]\n\nlocal M = {}\n\nM.MAX_NOTES = 1024\nM.PPQ       = 960\n\n-- Everything leaves at one velocity. Shaping a block's dynamics is a job for\n-- the MIDI editor once it is in the project, not for seven sliders here.\nM.VELOCITY  = 100\n\n------------------------------------------------------------------------------\n-- Keys\n--\n-- These are ScaleView for REAPER's roots and scales, unchanged, so the two\n-- apps agree on what a scale is and on what to call its notes. Both spellings\n-- of every pitch class are here plus Cb, because C# major and Db major are the\n-- same seven notes written differently and the difference is what the note\n-- names come out as.\n------------------------------------------------------------------------------\n\nlocal LETTER_PC = { 0, 2, 4, 5, 7, 9, 11 }        -- C D E F G A B\nlocal LETTERS   = { \"C\", \"D\", \"E\", \"F\", \"G\", \"A\", \"B\" }\nlocal ACCIDENTAL = { [-2] = \"bb\", [-1] = \"b\", [0] = \"\", [1] = \"#\", [2] = \"x\" }\n\nM.ROOTS = {\n  { name = \"C\",  letter = 0, acc =  0 }, { name = \"C#\", letter = 0, acc =  1 },\n  { name = \"Db\", letter = 1, acc = -1 }, { name = \"D\",  letter = 1, acc =  0 },\n  { name = \"D#\", letter = 1, acc =  1 }, { name = \"Eb\", letter = 2, acc = -1 },\n  { name = \"E\",  letter = 2, acc =  0 }, { name = \"F\",  letter = 3, acc =  0 },\n  { name = \"F#\", letter = 3, acc =  1 }, { name = \"Gb\", letter = 4, acc = -1 },\n  { name = \"G\",  letter = 4, acc =  0 }, { name = \"G#\", letter = 4, acc =  1 },\n  { name = \"Ab\", letter = 5, acc = -1 }, { name = \"A\",  letter = 5, acc =  0 },\n  { name = \"A#\", letter = 5, acc =  1 }, { name = \"Bb\", letter = 6, acc = -1 },\n  { name = \"B\",  letter = 6, acc =  0 }, { name = \"Cb\", letter = 0, acc = -1 },\n}\n\n-- iv is semitones from the root; letters is how many letter-names each degree\n-- sits above the root letter, which is what makes F# major spell its seventh\n-- E# rather than F.\nM.SCALES = {\n  { name = \"Major\",      iv = {0,2,4,5,7,9,11},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Minor\",      iv = {0,2,3,5,7,8,10},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Harm Minor\", iv = {0,2,3,5,7,8,11},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Ionian\",     iv = {0,2,4,5,7,9,11},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Dorian\",     iv = {0,2,3,5,7,9,10},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Phrygian\",   iv = {0,1,3,5,7,8,10},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Lydian\",     iv = {0,2,4,6,7,9,11},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Mixolydian\", iv = {0,2,4,5,7,9,10},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Aeolian\",    iv = {0,2,3,5,7,8,10},   letters = {0,1,2,3,4,5,6} },\n  { name = \"Maj Pent\",   iv = {0,2,4,7,9},        letters = {0,1,2,4,5} },\n  { name = \"Min Pent\",   iv = {0,3,5,7,10},       letters = {0,2,3,4,6} },\n  { name = \"Maj Blues\",  iv = {0,2,3,4,7,9},      letters = {0,1,2,2,4,5} },\n  { name = \"Min Blues\",  iv = {0,3,5,6,7,10},     letters = {0,2,3,4,4,6} },\n  { name = \"Whole Tone\", iv = {0,2,4,6,8,10},     letters = {0,1,2,3,4,5} },\n  { name = \"Dim W-H\",    iv = {0,2,3,5,6,8,9,11}, letters = {0,1,2,3,4,5,5,6} },\n  { name = \"Dim H-W\",    iv = {0,1,3,4,6,7,9,10}, letters = {0,1,2,2,3,4,5,6} },\n}\n\nM.DEGREE_TITLES = { \"Tonic\", \"Supertonic\", \"Mediant\", \"Subdominant\",\n                    \"Dominant\", \"Submediant\", \"Leading Tone\" }\n\nlocal NUMERALS = { \"I\", \"II\", \"III\", \"IV\", \"V\", \"VI\", \"VII\", \"VIII\" }\n\n------------------------------------------------------------------------------\n-- Chords\n--\n-- One row per chord, carrying its own name, symbol and intervals. Under JSFX\n-- these were three parallel tables and adding a chord meant editing all three\n-- in step; here a chord is one thing and cannot half-exist.\n--\n-- Semitones are from the chord's root. The families follow Wikipedia's list of\n-- chords.\n------------------------------------------------------------------------------\n\nM.FAMILIES = { \"Diatonic\", \"Triads\", \"6ths & 7ths\", \"Extended\", \"Altered\",\n               \"Sus & Add\", \"Quartal\", \"Named\" }\n\nlocal T, S7, EX, AL, SA, QU, NA = 2, 3, 4, 5, 6, 7, 8   -- indices into FAMILIES\n\nM.CHORDS = {\n  { sym=\"maj\",  name=\"Major\",                  iv={0,4,7},          fam=T },\n  { sym=\"m\",    name=\"Minor\",                  iv={0,3,7},          fam=T },\n  { sym=\"dim\",  name=\"Diminished\",             iv={0,3,6},          fam=T },\n  { sym=\"aug\",  name=\"Augmented\",              iv={0,4,8},          fam=T },\n  { sym=\"b5\",   name=\"Flat Five\",              iv={0,4,6},          fam=T },\n  { sym=\"5\",    name=\"Fifth (Power)\",          iv={0,7},            fam=T },\n\n  { sym=\"6\",       name=\"Sixth\",                    iv={0,4,7,9},     fam=S7 },\n  { sym=\"m6\",      name=\"Minor Sixth\",              iv={0,3,7,9},     fam=S7 },\n  { sym=\"6/9\",     name=\"Six-Nine\",                 iv={0,4,7,9,14},  fam=S7 },\n  { sym=\"m6/9\",    name=\"Minor Six-Nine\",           iv={0,3,7,9,14},  fam=S7 },\n  { sym=\"7\",       name=\"Dominant Seventh\",         iv={0,4,7,10},    fam=S7 },\n  { sym=\"maj7\",    name=\"Major Seventh\",            iv={0,4,7,11},    fam=S7 },\n  { sym=\"m7\",      name=\"Minor Seventh\",            iv={0,3,7,10},    fam=S7 },\n  { sym=\"mMaj7\",   name=\"Minor-Major Seventh\",      iv={0,3,7,11},    fam=S7 },\n  { sym=\"m7b5\",    name=\"Half-Diminished Seventh\",  iv={0,3,6,10},    fam=S7 },\n  { sym=\"dim7\",    name=\"Diminished Seventh\",       iv={0,3,6,9},     fam=S7 },\n  { sym=\"7#5\",     name=\"Augmented Seventh\",        iv={0,4,8,10},    fam=S7 },\n  { sym=\"maj7#5\",  name=\"Augmented Major Seventh\",  iv={0,4,8,11},    fam=S7 },\n  { sym=\"7b5\",     name=\"Seventh Flat Five\",        iv={0,4,6,10},    fam=S7 },\n  { sym=\"dimMaj7\", name=\"Diminished Major Seventh\", iv={0,3,6,11},    fam=S7 },\n  { sym=\"7/6\",     name=\"Seven Six\",                iv={0,4,7,9,10},  fam=S7 },\n\n  { sym=\"9\",     name=\"Ninth\",               iv={0,4,7,10,14},       fam=EX },\n  { sym=\"maj9\",  name=\"Major Ninth\",         iv={0,4,7,11,14},       fam=EX },\n  { sym=\"m9\",    name=\"Minor Ninth\",         iv={0,3,7,10,14},       fam=EX },\n  { sym=\"mMaj9\", name=\"Minor-Major Ninth\",   iv={0,3,7,11,14},       fam=EX },\n  { sym=\"11\",    name=\"Eleventh\",            iv={0,4,7,10,14,17},    fam=EX },\n  { sym=\"maj11\", name=\"Major Eleventh\",      iv={0,4,7,11,14,17},    fam=EX },\n  { sym=\"m11\",   name=\"Minor Eleventh\",      iv={0,3,7,10,14,17},    fam=EX },\n  { sym=\"13\",    name=\"Thirteenth\",          iv={0,4,7,10,14,17,21}, fam=EX },\n  { sym=\"maj13\", name=\"Major Thirteenth\",    iv={0,4,7,11,14,17,21}, fam=EX },\n  { sym=\"m13\",   name=\"Minor Thirteenth\",    iv={0,3,7,10,14,17,21}, fam=EX },\n\n  { sym=\"7b9\",       name=\"Seventh Flat Nine\",             iv={0,4,7,10,13},    fam=AL },\n  { sym=\"7#9\",       name=\"Seventh Sharp Nine\",            iv={0,4,7,10,15},    fam=AL },\n  { sym=\"7#11\",      name=\"Seventh Sharp Eleven\",          iv={0,4,7,10,18},    fam=AL },\n  { sym=\"7b13\",      name=\"Seventh Flat Thirteen\",         iv={0,4,7,10,20},    fam=AL },\n  { sym=\"7#5b9\",     name=\"Seventh Sharp Five Flat Nine\",  iv={0,4,8,10,13},    fam=AL },\n  { sym=\"7#5#9\",     name=\"Seventh Sharp Five Sharp Nine\", iv={0,4,8,10,15},    fam=AL },\n  { sym=\"7b5b9\",     name=\"Seventh Flat Five Flat Nine\",   iv={0,4,6,10,13},    fam=AL },\n  { sym=\"7alt\",      name=\"Altered Dominant\",              iv={0,4,8,10,13,15}, fam=AL },\n  { sym=\"13b9\",      name=\"Thirteenth Flat Nine\",          iv={0,4,7,10,13,21}, fam=AL },\n  { sym=\"maj7#11\",   name=\"Major Seventh Sharp Eleven\",    iv={0,4,7,11,18},    fam=AL },\n  { sym=\"m9b5\",      name=\"Minor Ninth Flat Five\",         iv={0,3,6,10,14},    fam=AL },\n  { sym=\"9#5\",       name=\"Ninth Augmented Fifth\",         iv={0,4,8,10,14},    fam=AL },\n  { sym=\"9b5\",       name=\"Ninth Flat Fifth\",              iv={0,4,6,10,14},    fam=AL },\n  { sym=\"9#11\",      name=\"Augmented Eleventh\",            iv={0,4,7,10,14,18}, fam=AL },\n  { sym=\"maj7#5#11\", name=\"Augmented Major Seventh Sharp Eleven\", iv={0,4,8,11,18}, fam=AL },\n  { sym=\"13b9b5\",    name=\"Thirteenth Flat Nine Flat Five\", iv={0,4,6,10,13,21}, fam=AL },\n\n  { sym=\"sus2\",     name=\"Suspended Second\",             iv={0,2,7},       fam=SA },\n  { sym=\"sus4\",     name=\"Suspended Fourth\",             iv={0,5,7},       fam=SA },\n  { sym=\"7sus4\",    name=\"Seventh Suspended Fourth\",     iv={0,5,7,10},    fam=SA },\n  { sym=\"9sus4\",    name=\"Ninth Suspended Fourth\",       iv={0,5,7,10,14}, fam=SA },\n  { sym=\"maj7sus4\", name=\"Major Seventh Suspended Fourth\", iv={0,5,7,11},  fam=SA },\n  { sym=\"add9\",     name=\"Added Ninth\",                  iv={0,4,7,14},    fam=SA },\n  { sym=\"m(add9)\",  name=\"Minor Added Ninth\",            iv={0,3,7,14},    fam=SA },\n  { sym=\"add4\",     name=\"Added Fourth\",                 iv={0,4,5,7},     fam=SA },\n  { sym=\"add11\",    name=\"Added Eleventh\",               iv={0,4,7,17},    fam=SA },\n  { sym=\"add13\",    name=\"Added Thirteenth\",             iv={0,4,7,21},    fam=SA },\n  { sym=\"add2\",     name=\"Added Second\",                 iv={0,2,4,7},     fam=SA },\n  { sym=\"m(add2)\",  name=\"Minor Added Second\",           iv={0,2,3,7},     fam=SA },\n\n  { sym=\"Q4/3\",    name=\"Quartal Triad\",       iv={0,5,10},    fam=QU },\n  { sym=\"Q4/4\",    name=\"Quartal Tetrad\",      iv={0,5,10,15}, fam=QU },\n  { sym=\"Q5/3\",    name=\"Quintal Triad\",       iv={0,7,14},    fam=QU },\n  { sym=\"WT3\",     name=\"Whole-Tone Trichord\", iv={0,2,4},     fam=QU },\n  { sym=\"cluster\", name=\"Chromatic Cluster\",   iv={0,1,2},     fam=QU },\n  { sym=\"dia-cl\",  name=\"Diatonic Cluster\",    iv={0,2,4,5},   fam=QU },\n\n  -- Voiced as they stand rather than reduced to a pitch-class set: the list\n  -- gives the Tristan chord as 0 3 6 10, which makes it a half-diminished\n  -- seventh and indistinguishable from one.\n  { sym=\"Mystic\",    name=\"Mystic (Scriabin)\",   iv={0,6,10,16,21,26}, fam=NA },\n  { sym=\"Petrushka\", name=\"Petrushka\",           iv={0,4,6,7,10,13},   fam=NA },\n  { sym=\"Tristan\",   name=\"Tristan\",             iv={0,6,10,15},       fam=NA },\n  { sym=\"So What\",   name=\"So What\",             iv={0,5,10,15,19},    fam=NA },\n  { sym=\"Dream\",     name=\"Dream\",               iv={0,5,6,7},         fam=NA },\n  { sym=\"Vienna\",    name=\"Viennese Trichord\",   iv={0,1,6},           fam=NA },\n  { sym=\"Vienna II\", name=\"Viennese Trichord II\", iv={0,6,7},          fam=NA },\n  { sym=\"Napoleon\",  name=\"Ode-to-Napoleon\",     iv={0,1,4,5,8,9},     fam=NA },\n  { sym=\"Elektra\",   name=\"Elektra\",             iv={0,7,9,13,16},     fam=NA },\n  { sym=\"Farben\",    name=\"Farben\",              iv={0,8,11,16,21},    fam=NA },\n  { sym=\"It+6\",      name=\"Italian Sixth\",       iv={0,4,10},          fam=NA },\n  { sym=\"Fr+6\",      name=\"French Sixth\",        iv={0,4,6,10},        fam=NA },\n  { sym=\"Ger+6\",     name=\"German Sixth\",        iv={0,4,7,10},        fam=NA },\n}\n\n-- The chords the key hands you for free, as offsets in scale degrees from the\n-- one you picked. Always in key, which is why this is the default family.\nM.DIATONIC = {\n  { name = \"Triad\", offsets = {0,2,4} },\n  { name = \"7th\",   offsets = {0,2,4,6} },\n  { name = \"9th\",   offsets = {0,2,4,6,8} },\n  { name = \"11th\",  offsets = {0,2,4,6,8,10} },\n  { name = \"13th\",  offsets = {0,2,4,6,8,10,12} },\n  { name = \"6th\",   offsets = {0,2,4,5} },\n  { name = \"sus2\",  offsets = {0,1,4} },\n  { name = \"sus4\",  offsets = {0,3,4} },\n  { name = \"5th\",   offsets = {0,4} },\n}\n\n------------------------------------------------------------------------------\n-- Everything else in the catalogue\n------------------------------------------------------------------------------\n\nM.RATES = {\n  { name = \"1/64\", beats = 0.0625 }, { name = \"1/32\", beats = 0.125 },\n  { name = \"1/16\", beats = 0.25 },   { name = \"1/8\",  beats = 0.5 },\n  { name = \"1/4\",  beats = 1 },      { name = \"1/2\",  beats = 2 },\n  { name = \"1/1\",  beats = 4 },\n}\nM.RATE_MODS = {\n  { name = \"Straight\", mul = 1 },\n  { name = \"Triplet\",  mul = 2/3 },\n  { name = \"Dotted\",   mul = 1.5 },\n}\n\nM.DIRECTIONS = { \"Up\", \"Down\", \"Up/Down\", \"Down/Up\", \"Random\", \"Converge\", \"Diverge\" }\nM.MAX_REPEATS = 16\n\n-- How long a block is, as a multiple of a bar. Quarter and half bars are here\n-- because a block shorter than a bar is still a block.\nM.BAR_LENGTHS = {\n  { name = \"1/4\", bars = 0.25 }, { name = \"1/2\", bars = 0.5 },\n  { name = \"1\",   bars = 1 },    { name = \"2\",   bars = 2 },\n  { name = \"4\",   bars = 4 },    { name = \"8\",   bars = 8 },\n}\n\n-- An arpeggio or a run is measured one of two ways, and the user picks which:\n-- by how many passes it plays, or by filling a length the way it did before\n-- repeats existed.\nM.LENGTH_MODES = { \"Repeats\", \"Bars\" }\n\n-- What a melodic cell moves by, in scale steps. Sustain moves by nothing: it\n-- is one note held, which is the smallest melodic thing there is.\nM.INTERVALS = {\n  { name = \"2nd\",     steps = 1 },\n  { name = \"3rd\",     steps = 2 },\n  { name = \"4th\",     steps = 3 },\n  { name = \"5th\",     steps = 4 },\n  { name = \"6th\",     steps = 5 },\n  { name = \"7th\",     steps = 6 },\n  { name = \"Octave\",  octave = true },   -- however many steps this scale takes\n  { name = \"Sustain\", hold = true },\n}\nM.SHAPES     = { \"Single\", \"Return\", \"Fill\" }\n-- As many as the chord has members, less one: a triad has two inversions, a\n-- seventh three, a thirteenth six (M.inversionCount says how many a chord has).\nM.INVERSIONS = { \"Root\", \"1st\", \"2nd\", \"3rd\", \"4th\", \"5th\", \"6th\" }\n\nM.CATEGORIES = { \"Chord\", \"Arpeggio\", \"Run\", \"Melody\" }\n\n------------------------------------------------------------------------------\n-- Settings\n--\n-- One plain table describes a block completely. Every function below is a pure\n-- function of it, so a test can build one, ask for the notes, and check them.\n------------------------------------------------------------------------------\n\nfunction M.newState()\n  return {\n    root = 1, scale = 1, degree = 0,       -- degree is 0-based: 0 is the tonic\n    cat = \"Chord\",\n    family = 1, dia = 1, chord = 1,        -- family 1 is Diatonic\n    inv = 0, oct = 0,\n    pattern = 1,                           -- an index into DIRECTIONS\n    runDir = 1,\n    rate = 4, rateMod = 1,                 -- 1/8 straight\n    chop = 7,                              -- the chord is one 1/1 segment\n    octaves = 1, repeats = 1, bars = 1,\n    lengthMode = \"Repeats\",                -- how an arpeggio or run is measured\n    gate = 90,\n    interval = 1, melDir = 1, shape = 1,   -- a step, up, on its own\n    baseOct = 4,                           -- C4 is 60\n    barBeats = 4,                          -- what the project says a bar is\n  }\nend\n\n------------------------------------------------------------------------------\n-- Theory\n------------------------------------------------------------------------------\n\nfunction M.scaleLen(st) return #M.SCALES[st.scale].iv end\n\n-- The MIDI pitch of a scale degree, counting past the top of the scale into\n-- the octave above and below zero into the one below.\nfunction M.scalePitch(st, degree)\n  local sc  = M.SCALES[st.scale]\n  local n   = #sc.iv\n  local oct = math.floor(degree / n)\n  local k   = degree - oct * n\n  local rt  = M.ROOTS[st.root]\n  local pc  = (LETTER_PC[rt.letter + 1] + rt.acc + 120) % 12\n  return pc + (st.baseOct + 1) * 12 + sc.iv[k + 1] + oct * 12\nend\n\n-- Spelled for the key: the seventh of F# major comes out E#, not F.\nfunction M.noteName(st, degree)\n  local sc  = M.SCALES[st.scale]\n  local n   = #sc.iv\n  local oct = math.floor(degree / n)\n  local k   = degree - oct * n\n  local letter = (M.ROOTS[st.root].letter + sc.letters[k + 1]) % 7\n  local acc = M.scalePitch(st, degree) % 12 - LETTER_PC[letter + 1]\n  if acc >  6 then acc = acc - 12 end\n  if acc < -6 then acc = acc + 12 end\n  return LETTERS[letter + 1] .. (ACCIDENTAL[acc] or \"?\")\nend\n\n-- Read off the scale rather than assumed, so the modes and the blues scales\n-- come out right: the vii of major is diminished, the III of natural minor is\n-- major.\nfunction M.degreeQuality(st, degree)\n  local p  = M.scalePitch(st, degree)\n  local r3 = M.scalePitch(st, degree + 2) - p\n  local r5 = M.scalePitch(st, degree + 4) - p\n  if r3 == 4 and r5 == 7 then return \"major\"      end\n  if r3 == 3 and r5 == 7 then return \"minor\"      end\n  if r3 == 3 and r5 == 6 then return \"diminished\" end\n  if r3 == 4 and r5 == 8 then return \"augmented\"  end\n  return \"other\"\nend\n\nfunction M.degreeNumeral(st, degree, ascii)\n  local q = M.degreeQuality(st, degree)\n  local n = NUMERALS[(degree % 8) + 1]\n  if q == \"minor\" or q == \"diminished\" then n = n:lower() end\n  if q == \"diminished\" then n = n .. (ascii and \"dim\" or \"\\u{00B0}\") end\n  if q == \"augmented\"  then n = n .. (ascii and \"aug\" or \"+\") end\n  return n\nend\n\n-- Only the seven-note scales carry these names, and the seventh is a leading\n-- tone only when it really does lean on the tonic a semitone above.\nfunction M.degreeTitle(st, degree)\n  if M.scaleLen(st) ~= 7 then return \"Degree \" .. (degree + 1) end\n  if degree == 6 and M.scalePitch(st, 7) - M.scalePitch(st, 6) ~= 1 then\n    return \"Subtonic\"\n  end\n  return M.DEGREE_TITLES[degree + 1] or (\"Degree \" .. (degree + 1))\nend\n\n-- The chord stacked as the tables write it, root first: in thirds, or in the\n-- order a named chord lists its notes.\nlocal function stacked(st, degree)\n  local tones = {}\n  if st.family == 1 then\n    for _, off in ipairs(M.DIATONIC[st.dia].offsets) do\n      tones[#tones + 1] = M.scalePitch(st, degree + off) + st.oct * 12\n    end\n  else\n    local base = M.scalePitch(st, degree) + st.oct * 12\n    for _, iv in ipairs(M.CHORDS[st.chord].iv) do\n      tones[#tones + 1] = base + iv\n    end\n  end\n  return tones\nend\n\n-- The chord's members in stacked order, each note name once: what an\n-- inversion can put in the bass. A pentatonic thirteenth comes back round to\n-- its root, and a note the chord already has is not a new member.\nlocal function members(tones)\n  local seen, out = {}, {}\n  for i, p in ipairs(tones) do\n    if not seen[p % 12] then seen[p % 12] = true; out[#out + 1] = i end\n  end\n  return out\nend\n\n-- How many inversions the chord has: one for each member that can go in the\n-- bass after the root. Two for a triad, three for a seventh, four for a ninth,\n-- six for a thirteenth; one for a power chord.\nfunction M.inversionCount(st, degree)\n  return math.max(0, #members(stacked(st, degree or st.degree or 0)) - 1)\nend\n\nfunction M.inversionNames(st)\n  local out = {}\n  for i = 1, M.inversionCount(st) + 1 do out[i] = M.INVERSIONS[i] end\n  return out\nend\n\n-- The chord's pitches, ascending. Inversion n puts the chord's (n+1)th member\n-- in the bass - the 3rd for the 1st, the 5th for the 2nd, the 7th for the 3rd,\n-- the 9th for the 4th - and lifts the members under it by octaves until they\n-- sit above it. One octave is not always enough: a ninth's root lifted once\n-- is still under the ninth.\nfunction M.chordTones(st, degree, inv)\n  local tones = stacked(st, degree)\n  local idx   = members(tones)\n  inv = math.max(0, math.min(math.floor(inv or 0), #idx - 1))\n  if inv > 0 then\n    local cut  = idx[inv + 1]\n    local bass = tones[cut]\n    local kept, lifted = {}, {}\n    for i = cut, #tones do kept[#kept + 1] = tones[i] end\n    for i = 1, cut - 1 do lifted[#lifted + 1] = tones[i] end\n    local taken = {}\n    for _, p in ipairs(kept) do taken[p] = true end\n    for _, p in ipairs(lifted) do\n      p = p + 12\n      while p <= bass or taken[p] do p = p + 12 end\n      taken[p] = true\n      kept[#kept + 1] = p\n    end\n    tones = kept\n  end\n  table.sort(tones)\n  return tones\nend\n\nfunction M.rateByName(name)\n  for _, r in ipairs(M.RATES) do if r.name == name then return r.beats end end\n  return 4\nend\n\n-- Straight, triplet or dotted. One setting, shown on every panel, applied\n-- wherever that panel reads a rate: the chord's chop, and the step an\n-- arpeggio, run or melody walks in.\nfunction M.modMul(st) return M.RATE_MODS[st.rateMod].mul end\n\n-- What to put after a rate in a block's name, so \"1/8\" and \"1/8 triplet\" are\n-- not two files with the same name.\nfunction M.modSuffix(st)\n  local name = M.RATE_MODS[st.rateMod].name\n  if name == \"Triplet\" then return \"T\" end\n  if name == \"Dotted\"  then return \".\" end\n  return \"\"\nend\n\nfunction M.rateBeats(st)\n  return M.RATES[st.rate].beats * M.modMul(st)\nend\n\n-- The chord's segment, which is its own rate rather than the shared one.\nfunction M.chopBeats(st)\n  return M.RATES[st.chop].beats * M.modMul(st)\nend\n\n-- Settings can arrive from a saved project written by an older version, or one\n-- whose tables were a different size. Every index here is used to look\n-- something up, so anything past the end of its table has to come back inside\n-- it before the rest of the program trusts it.\nfunction M.clampState(st)\n  local function pin(v, lo, hi, fallback)\n    v = tonumber(v) or fallback\n    return math.max(lo, math.min(math.floor(v), hi))\n  end\n\n  st.root     = pin(st.root, 1, #M.ROOTS, 1)\n  st.scale    = pin(st.scale, 1, #M.SCALES, 1)\n  st.family   = pin(st.family, 1, #M.FAMILIES, 1)\n  st.chord    = pin(st.chord, 1, #M.CHORDS, 1)\n  st.dia      = pin(st.dia, 1, #M.DIATONIC, 1)\n  st.rate     = pin(st.rate, 1, #M.RATES, 4)\n  st.rateMod  = pin(st.rateMod, 1, #M.RATE_MODS, 1)\n  st.runDir   = pin(st.runDir, 1, #M.DIRECTIONS, 1)\n  st.pattern  = pin(st.pattern, 1, #M.DIRECTIONS, 1)\n  st.interval = pin(st.interval, 1, #M.INTERVALS, 1)\n  st.melDir   = pin(st.melDir, 1, 2, 1)\n  st.shape    = pin(st.shape, 1, #M.SHAPES, 1)\n  st.chop        = pin(st.chop, 1, #M.RATES, #M.RATES)\n\n  -- Ranges the sliders declare. A value outside one of these is what ReaImGui\n  -- refuses, so they have to agree with the UI.\n  st.oct      = pin(st.oct, -3, 3, 0)\n  st.octaves  = pin(st.octaves, 1, 4, 1)\n  st.repeats  = pin(st.repeats, 1, M.MAX_REPEATS, 1)\n  st.gate     = pin(st.gate, 5, 100, 90)\n  st.baseOct  = pin(st.baseOct, 0, 8, 4)\n  -- Bars are picked from a list rather than typed, and the list has fractions\n  -- in it, so snap to the nearest entry instead of rounding to an integer.\n  -- The list ascends and the comparison is strict, so a value exactly between\n  -- two entries keeps the shorter: a block that is too short is easier to\n  -- notice than one that is too long.\n  local bars, best = tonumber(st.bars) or 1, nil\n  for _, b in ipairs(M.BAR_LENGTHS) do\n    if not best or math.abs(b.bars - bars) < math.abs(best - bars) then best = b.bars end\n  end\n  st.bars = best\n\n  local mode = false\n  for _, m in ipairs(M.LENGTH_MODES) do if m == st.lengthMode then mode = true end end\n  if not mode then st.lengthMode = M.LENGTH_MODES[1] end\n\n  local found = false\n  for _, c in ipairs(M.CATEGORIES) do if c == st.cat then found = true end end\n  if not found then st.cat = M.CATEGORIES[1] end\n\n  st.degree = pin(st.degree, 0, M.scaleLen(st) - 1, 0)\n  -- As many inversions as this chord has, so last, once the chord, the scale\n  -- and the degree it reads are sound: a ninth's 4th is nothing on a triad,\n  -- which stops at its 2nd.\n  st.inv    = pin(st.inv, 0, M.inversionCount(st), 0)\n  return st\nend\n\nfunction M.chordLabel(st)\n  if st.family == 1 then return M.DIATONIC[st.dia].name end\n  return M.CHORDS[st.chord].sym\nend\n\n------------------------------------------------------------------------------\n-- Generators\n--\n-- Each one fills c.notes and says how long the block it made is, in c.len.\n-- The bar-based block - the chord - is handed a length and fills it.\n-- The others decide their own: a melodic cell is as long as its notes, and an\n-- arpeggio or a run is as long as the number of repeats asks for.\n------------------------------------------------------------------------------\n\nlocal function addNote(c, start, len, pitch, vel)\n  if #c.notes >= M.MAX_NOTES then c.truncated = true; return end\n  if pitch < 0 or pitch > 127 then return end\n  c.notes[#c.notes + 1] = {\n    start = start,\n    len   = math.max(len, 0.015),\n    pitch = math.floor(pitch),\n    vel   = math.max(1, math.min(127, math.floor(vel))),\n  }\nend\n\n-- Lays a list of pitches out in playing order for one of the seven directions.\nlocal function applyDirection(pool, dir)\n  local out, m = {}, #pool\n  if m == 0 then return out end\n  local name = M.DIRECTIONS[dir]\n\n  if name == \"Up\" then\n    for i = 1, m do out[#out + 1] = pool[i] end\n\n  elseif name == \"Down\" then\n    for i = m, 1, -1 do out[#out + 1] = pool[i] end\n\n  elseif name == \"Up/Down\" then\n    for i = 1, m do out[#out + 1] = pool[i] end\n    for i = m - 1, 2, -1 do out[#out + 1] = pool[i] end\n\n  elseif name == \"Down/Up\" then\n    for i = m, 1, -1 do out[#out + 1] = pool[i] end\n    for i = 2, m - 1 do out[#out + 1] = pool[i] end\n\n  elseif name == \"Random\" then\n    -- A shuffle rather than free picks, so every pitch gets its turn before\n    -- any of them repeats.\n    for i = 1, m do out[i] = pool[i] end\n    for i = m, 2, -1 do\n      local j = math.random(i)\n      out[i], out[j] = out[j], out[i]\n    end\n\n  elseif name == \"Converge\" then          -- outside in\n    local lo, hi = 1, m\n    while lo <= hi do\n      out[#out + 1] = pool[lo]; lo = lo + 1\n      if lo <= hi then out[#out + 1] = pool[hi]; hi = hi - 1 end\n    end\n\n  elseif name == \"Diverge\" then           -- middle out\n    local lo = math.floor((m + 1) / 2)\n    local hi = lo + 1\n    while lo >= 1 or hi <= m do\n      if lo >= 1 then out[#out + 1] = pool[lo]; lo = lo - 1 end\n      if hi <= m then out[#out + 1] = pool[hi]; hi = hi + 1 end\n    end\n  end\n  return out\nend\nM._applyDirection = applyDirection\n\n-- Plays a sequence through `count` times over, one pitch per step, and sizes\n-- the block to exactly that. Counting the notes rather than walking a clock\n-- keeps the last one from falling a rounding error short of the end.\nlocal function layRepeats(st, c, seq, repeats)\n  if #seq == 0 then return end\n  local step  = M.rateBeats(st)\n  local count = repeats * #seq\n  for i = 0, count - 1 do\n    addNote(c, i * step, step * st.gate / 100, seq[(i % #seq) + 1], M.VELOCITY)\n    if c.truncated then break end\n  end\n  c.len = count * step\nend\n\n-- Cycles a sequence over a length that is already decided, which is how an\n-- arpeggio worked before repeats existed: it plays until the block runs out,\n-- wherever in the pass that happens to fall.\nlocal function layFill(st, c, seq)\n  if #seq == 0 then return end\n  local step = M.rateBeats(st)\n  local n    = math.max(1, math.ceil(c.len / step - 1e-9))\n  for i = 0, n - 1 do\n    local at = i * step\n    addNote(c, at, math.min(step * st.gate / 100, c.len - at),\n            seq[(i % #seq) + 1], M.VELOCITY)\n    if c.truncated then return end\n  end\nend\n\n-- Whichever way this block is being measured.\nlocal function layOut(st, c, seq)\n  if st.lengthMode == \"Bars\" then layFill(st, c, seq)\n  else layRepeats(st, c, seq, st.repeats) end\nend\n\n-- How many notes a single pass of an arpeggio or a run comes to. Worth knowing\n-- on screen: it is what one repeat actually costs.\nfunction M.passLength(st)\n  if st.cat == \"Arpeggio\" then\n    local tones = M.chordTones(st, st.degree, st.inv)\n    if #tones == 0 then return 0 end\n    local pool = {}\n    for o = 0, st.octaves - 1 do\n      for _, p in ipairs(tones) do pool[#pool + 1] = p + o * 12 end\n    end\n    return #applyDirection(pool, st.pattern)\n  elseif st.cat == \"Run\" then\n    local n = M.scaleLen(st) * st.octaves + 1\n    local pool = {}\n    for i = 1, n do pool[i] = i end\n    return #applyDirection(pool, st.runDir)\n  end\n  return 0\nend\n\nlocal GEN = {}\n\nGEN.Chord = function(st, c)\n  -- The block is chopped into segments and the chord struck again in each one.\n  -- At 1/1 over one bar that is a single held chord, which is what it was\n  -- before the chop existed.\n  local tones = M.chordTones(st, st.degree, st.inv)\n  local seg   = M.chopBeats(st)\n  local n     = math.max(1, math.ceil(c.len / seg - 1e-9))\n  for i = 0, n - 1 do\n    local at  = i * seg\n    local len = math.min(seg, c.len - at) * st.gate / 100\n    for _, p in ipairs(tones) do addNote(c, at, len, p, M.VELOCITY) end\n    if c.truncated then return end\n  end\nend\n\nGEN.Arpeggio = function(st, c)\n  local tones = M.chordTones(st, st.degree, st.inv)\n  if #tones == 0 then return end\n  local pool = {}\n  for o = 0, st.octaves - 1 do\n    for _, p in ipairs(tones) do pool[#pool + 1] = p + o * 12 end\n  end\n  layOut(st, c, applyDirection(pool, st.pattern))\nend\n\nGEN.Run = function(st, c)\n  local pool = {}\n  -- Inclusive of the octave above, so a one-octave run lands back on the note\n  -- it started from.\n  for i = 0, M.scaleLen(st) * st.octaves do\n    pool[#pool + 1] = M.scalePitch(st, st.degree + i) + st.oct * 12\n  end\n  layOut(st, c, applyDirection(pool, st.runDir))\nend\n\nfunction M.isSustain(st) return M.INTERVALS[st.interval].hold == true end\n\n-- How many scale steps the cell moves. An octave is however many this\n-- particular scale takes to get there, which is five in a pentatonic.\nfunction M.melodySteps(st)\n  local iv = M.INTERVALS[st.interval]\n  if iv.hold then return 0 end\n  if iv.octave then return M.scaleLen(st) end\n  return iv.steps\nend\n\n-- A melodic cell is however long its own notes make it.\nfunction M.melodyBeats(st)\n  if M.isSustain(st) then return M.rateBeats(st) end\n  local steps = M.melodySteps(st)\n  local n = (st.shape == 1 and 2) or (st.shape == 2 and 3) or (steps + 1)\n  return M.rateBeats(st) * n\nend\n\nGEN.Melody = function(st, c)\n  local step = M.rateBeats(st)\n  local len  = step * st.gate / 100\n  local a    = M.scalePitch(st, st.degree) + st.oct * 12\n\n  -- One note, held for the rate. Nothing moves, so there is no direction and\n  -- no shape to give it.\n  if M.isSustain(st) then\n    addNote(c, 0, len, a, M.VELOCITY)\n    c.len = step\n    return\n  end\n\n  -- A 2nd is one scale step, a 3rd is two, and the octave is however many\n  -- steps this particular scale takes to get there.\n  local steps = M.melodySteps(st)\n  local dir   = (st.melDir == 1) and 1 or -1\n  local b = M.scalePitch(st, st.degree + dir * steps) + st.oct * 12\n\n  if st.shape == 1 then                      -- Single: the move\n    addNote(c, 0, len, a, M.VELOCITY)\n    addNote(c, step, len, b, M.VELOCITY)\n  elseif st.shape == 2 then                  -- Return: there and back\n    addNote(c, 0, len, a, M.VELOCITY)\n    addNote(c, step, len, b, M.VELOCITY)\n    addNote(c, step * 2, len, a, M.VELOCITY)\n  else                                       -- Fill: every note in between\n    for i = 0, steps do\n      addNote(c, i * step, len,\n              M.scalePitch(st, st.degree + dir * i) + st.oct * 12, M.VELOCITY)\n    end\n  end\n  c.len = M.melodyBeats(st)\nend\n\n------------------------------------------------------------------------------\n-- The block\n------------------------------------------------------------------------------\n\n-- The label for whatever st.bars currently is, as the list spells it.\nfunction M.barsLabel(st)\n  for _, b in ipairs(M.BAR_LENGTHS) do\n    if math.abs(b.bars - st.bars) < 1e-9 then return b.name end\n  end\n  return tostring(st.bars)\nend\n\nfunction M.blockName(st)\n  local root  = M.ROOTS[st.root].name\n  local scale = M.SCALES[st.scale].name\n  local where = M.degreeNumeral(st, st.degree, true)\n  local rate  = M.RATES[st.rate].name .. M.modSuffix(st)\n  -- How the block was measured belongs in its name: \"x3\" is three passes,\n  -- \"1/2 bar\" is a length the pass was cut to fit.\n  local times = \"\"\n  if st.lengthMode == \"Bars\" then\n    times = \" \" .. M.barsLabel(st) .. \" bar\"\n  elseif st.repeats > 1 then\n    times = \" x\" .. st.repeats\n  end\n\n  if st.cat == \"Chord\" then\n    local chop = (st.chop < #M.RATES or st.rateMod > 1)\n                 and (\" \" .. M.RATES[st.chop].name .. M.modSuffix(st)) or \"\"\n    return (\"%s %s %s Chord %s%s\"):format(root, scale, where,\n                                          M.chordLabel(st), chop)\n  elseif st.cat == \"Arpeggio\" then\n    return (\"%s %s %s Arp %s %s %s%s\"):format(root, scale, where,\n      M.chordLabel(st), M.DIRECTIONS[st.pattern], rate, times)\n  elseif st.cat == \"Run\" then\n    return (\"%s %s %s Run %s %s%s\"):format(root, scale, where,\n      M.DIRECTIONS[st.runDir], rate, times)\n  elseif st.cat == \"Melody\" then\n    -- A sustained note has no direction and no shape, so its name claims\n    -- neither of them.\n    if M.isSustain(st) then\n      return (\"%s %s %s Melody Sustain %s\"):format(root, scale, where, rate)\n    end\n    return (\"%s %s %s Melody %s %s %s\"):format(root, scale, where,\n      (st.melDir == 1) and \"Up\" or \"Down\",\n      M.INTERVALS[st.interval].name, M.SHAPES[st.shape])\n  end\nend\n\n-- The whole point of the file. Returns the notes in quarter notes from the\n-- start of the block, how long the block is, and what it is called.\nfunction M.generate(st)\n  -- The length a bar-based block fills. A self-sizing one replaces it.\n  local c = { notes = {}, len = st.barBeats * st.bars, truncated = false }\n  ;(GEN[st.cat] or GEN.Chord)(st, c)\n  return {\n    notes     = c.notes,\n    beats     = math.max(c.len, 0.0625),\n    name      = M.blockName(st),\n    truncated = c.truncated,\n  }\nend\n\nreturn M\n"};

/* ---- kit/runtime/polyfill.js ---- */
/* What JavaScriptCore lacks and the Lua runtime uses: TextEncoder and
 * TextDecoder, UTF-8 only, as the web defines them (an invalid byte decodes
 * to U+FFFD and decoding goes on). Installed only where they are missing, so
 * Node and browsers keep their own; MiddawUTF8 is the same code, always, for
 * the tests to hold against the real thing.
 */
(function (G) {
  'use strict';
  function encode(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
        else c = 0xFFFD;
      } else if (c >= 0xD800 && c <= 0xDFFF) c = 0xFFFD;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }
  function decode(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    var out = '', i = 0, n = b.length;
    while (i < n) {
      var c = b[i], need = 0, cp = 0, min = 0;
      if (c < 0x80) { out += String.fromCharCode(c); i++; continue; }
      else if (c >= 0xC2 && c <= 0xDF) { need = 1; cp = c & 0x1F; min = 0x80; }
      else if (c >= 0xE0 && c <= 0xEF) { need = 2; cp = c & 0x0F; min = 0x800; }
      else if (c >= 0xF0 && c <= 0xF4) { need = 3; cp = c & 0x07; min = 0x10000; }
      else { out += '�'; i++; continue; }
      var j = 1, ok = true;
      for (; j <= need; j++) {
        if (i + j >= n) { ok = false; break; }
        var x = b[i + j];
        // the second byte's range is narrower for a few leads (no overlongs, no surrogates)
        var lo = 0x80, hi = 0xBF;
        if (j === 1) {
          if (c === 0xE0) lo = 0xA0; else if (c === 0xED) hi = 0x9F;
          else if (c === 0xF0) lo = 0x90; else if (c === 0xF4) hi = 0x8F;
        }
        if (x < lo || x > hi) { ok = false; break; }
        cp = (cp << 6) | (x & 0x3F);
      }
      if (!ok || cp < min) { out += '�'; i += Math.max(1, j); continue; }
      if (cp >= 0x10000) { cp -= 0x10000; out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
      else out += String.fromCharCode(cp);
      i += need + 1;
    }
    return out;
  }
  function Enc() {}
  Enc.prototype.encode = function (s) { return encode(String(s === undefined ? '' : s)); };
  function Dec() {}
  Dec.prototype.decode = function (b) { return decode(b); };
  G.MiddawUTF8 = { TextEncoder: Enc, TextDecoder: Dec };
  if (typeof G.TextEncoder === 'undefined') G.TextEncoder = Enc;
  if (typeof G.TextDecoder === 'undefined') G.TextDecoder = Dec;
})(typeof globalThis !== 'undefined' ? globalThis : this);


/* ---- kit/runtime/lua_parse.js ---- */
/* Middaw's Lua 5.4, part 1 of 3: the lexer and the parser.
 *
 * Middaw runs the family's Lua engines (Good Idea, Midi Suggester, Midi
 * Variator, Midi Catalogue, Starting Blocks, DAW Battle Pass...) unchanged, in
 * the browser, with no third-party code: this file reads Lua source into a
 * syntax tree, lua_compile.js turns the tree into JavaScript, lua_runtime.js
 * supplies the values and the standard library. tests/js/test_lua.js holds
 * all three to what the real Lua 5.4 prints for the same programs.
 *
 * Source is a "byte string": one JS character per byte of the file, which is
 * how Lua itself sees a string, so `#s` and string.sub count bytes as Lua does.
 */
(function (NS) {
  'use strict';

  var KEYWORDS = {};
  ('and break do else elseif end false for function goto if in local nil not ' +
   'or repeat return then true until while').split(' ').forEach(function (k) { KEYWORDS[k] = true; });

  function LuaSyntaxError(message, chunk, line) {
    this.message = chunk + ':' + line + ': ' + message;
    this.line = line;
  }
  LuaSyntaxError.prototype = Object.create(Error.prototype);
  LuaSyntaxError.prototype.name = 'LuaSyntaxError';

  function isDigit(c) { return c >= 48 && c <= 57; }
  function isHex(c) { return isDigit(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70); }
  function isAlpha(c) { return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95; }
  function isSpace(c) { return c === 32 || (c >= 9 && c <= 13); }

  // ---------------------------------------------------------------- lexer --
  function lex(src, chunk) {
    var toks = [];
    var i = 0, n = src.length, line = 1;
    function err(msg) { throw new LuaSyntaxError(msg, chunk, line); }
    function longBracketLevel(at) {   // at points to '['; returns level or -1
      var j = at + 1, level = 0;
      while (src.charCodeAt(j) === 61) { level++; j++; }
      return src.charCodeAt(j) === 91 ? level : -1;
    }
    function readLong(at, level) {    // returns [content, end index]
      var start = at + level + 2;
      // a newline straight after the opening bracket is skipped
      if (src[start] === '\r') { start++; if (src[start] === '\n') start++; }
      else if (src[start] === '\n') { start++; if (src[start] === '\r') start++; }
      var close = ']' + '='.repeat(level) + ']';
      var end = src.indexOf(close, start);
      if (end < 0) err('unfinished long string');
      var body = src.slice(start, end);
      for (var k = at; k < end + close.length; k++) if (src.charCodeAt(k) === 10) line++;
      return [body, end + close.length];
    }
    while (i < n) {
      var c = src.charCodeAt(i);
      if (c === 10) { line++; i++; continue; }
      if (isSpace(c)) { i++; continue; }
      if (c === 45 && src.charCodeAt(i + 1) === 45) {           // comment
        i += 2;
        if (src.charCodeAt(i) === 91) {
          var lvl = longBracketLevel(i);
          if (lvl >= 0) { i = readLong(i, lvl)[1]; continue; }
        }
        while (i < n && src.charCodeAt(i) !== 10) i++;
        continue;
      }
      var tline = line;
      if (isAlpha(c)) {
        var j = i + 1;
        while (j < n && (isAlpha(src.charCodeAt(j)) || isDigit(src.charCodeAt(j)))) j++;
        var word = src.slice(i, j);
        toks.push(KEYWORDS[word] ? { t: word, line: tline } : { t: 'name', v: word, line: tline });
        i = j; continue;
      }
      if (isDigit(c) || (c === 46 && isDigit(src.charCodeAt(i + 1)))) {
        var j2 = i, isFloat = false, text;
        if (c === 48 && (src[i + 1] === 'x' || src[i + 1] === 'X')) {
          j2 = i + 2;
          while (j2 < n) {
            var d = src.charCodeAt(j2);
            if (isHex(d) || d === 46) { if (d === 46) isFloat = true; j2++; }
            else if ((d === 112 || d === 80)) {
              isFloat = true; j2++;
              if (src[j2] === '+' || src[j2] === '-') j2++;
            } else break;
          }
        } else {
          while (j2 < n) {
            var e = src.charCodeAt(j2);
            if (isDigit(e) || e === 46) { if (e === 46) isFloat = true; j2++; }
            else if (e === 101 || e === 69) {
              isFloat = true; j2++;
              if (src[j2] === '+' || src[j2] === '-') j2++;
            } else break;
          }
        }
        text = src.slice(i, j2);
        if (j2 < n && (isAlpha(src.charCodeAt(j2)))) err("malformed number near '" + text + src[j2] + "'");
        toks.push({ t: 'number', v: text, line: tline });
        i = j2; continue;
      }
      if (c === 34 || c === 39) {                                // short string
        var q = c, out = [], k = i + 1;
        for (;;) {
          if (k >= n) err('unfinished string');
          var ch = src.charCodeAt(k);
          if (ch === q) { k++; break; }
          if (ch === 10) err('unfinished string');
          if (ch === 92) {
            var x = src[k + 1];
            k += 2;
            switch (x) {
              case 'n': out.push('\n'); break;
              case 't': out.push('\t'); break;
              case 'r': out.push('\r'); break;
              case 'a': out.push('\x07'); break;
              case 'b': out.push('\b'); break;
              case 'f': out.push('\f'); break;
              case 'v': out.push('\v'); break;
              case '\\': out.push('\\'); break;
              case '"': out.push('"'); break;
              case "'": out.push("'"); break;
              case '\n': line++; out.push('\n'); break;
              case 'x': {
                var hx = src.slice(k, k + 2);
                if (!/^[0-9a-fA-F]{2}$/.test(hx)) err('hexadecimal digit expected');
                out.push(String.fromCharCode(parseInt(hx, 16))); k += 2; break;
              }
              case 'z': {
                while (k < n && isSpace(src.charCodeAt(k))) { if (src.charCodeAt(k) === 10) line++; k++; }
                break;
              }
              case 'u': {
                if (src[k] !== '{') err("missing '{' in \\u{xxxx}");
                var close = src.indexOf('}', k);
                var cp = parseInt(src.slice(k + 1, close), 16);
                k = close + 1;
                out.push(utf8Bytes(cp)); break;
              }
              default: {
                if (x !== undefined && isDigit(x.charCodeAt(0))) {
                  var digits = x; var m = 0;
                  while (m < 2 && isDigit(src.charCodeAt(k))) { digits += src[k]; k++; m++; }
                  var val = parseInt(digits, 10);
                  if (val > 255) err('decimal escape too large');
                  out.push(String.fromCharCode(val));
                } else err('invalid escape sequence');
              }
            }
            continue;
          }
          out.push(src[k]); k++;
        }
        toks.push({ t: 'string', v: out.join(''), line: tline });
        i = k; continue;
      }
      if (c === 91) {
        var lv = longBracketLevel(i);
        if (lv >= 0) {
          var r = readLong(i, lv);
          toks.push({ t: 'string', v: r[0], line: tline });
          i = r[1]; continue;
        }
      }
      var three = src.substr(i, 3), two = src.substr(i, 2);
      if (three === '...') { toks.push({ t: '...', line: tline }); i += 3; continue; }
      if (two === '==' || two === '~=' || two === '<=' || two === '>=' || two === '//' ||
          two === '::' || two === '<<' || two === '>>' || two === '..') {
        toks.push({ t: two, line: tline }); i += 2; continue;
      }
      var one = src[i];
      if ('+-*/%^#&~|<>=(){}[];:,.'.indexOf(one) >= 0) { toks.push({ t: one, line: tline }); i++; continue; }
      err("unexpected symbol near '" + one + "'");
    }
    toks.push({ t: '<eof>', line: line });
    return toks;
  }

  function utf8Bytes(cp) {
    if (cp < 0x80) return String.fromCharCode(cp);
    if (cp < 0x800) return String.fromCharCode(0xC0 | (cp >> 6), 0x80 | (cp & 63));
    if (cp < 0x10000) return String.fromCharCode(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    return String.fromCharCode(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
  }

  // --------------------------------------------------------------- parser --
  // Binary priorities exactly as lparser.c has them: { left, right }.
  var BINARY = {
    '+': [10, 10], '-': [10, 10], '*': [11, 11], '%': [11, 11], '^': [14, 13],
    '/': [11, 11], '//': [11, 11], '&': [6, 6], '|': [4, 4], '~': [5, 5],
    '<<': [7, 7], '>>': [7, 7], '..': [9, 8],
    '==': [3, 3], '<': [3, 3], '<=': [3, 3], '~=': [3, 3], '>': [3, 3], '>=': [3, 3],
    'and': [2, 2], 'or': [1, 1]
  };
  var UNARY_PRIORITY = 12;

  function parse(src, chunk) {
    chunk = chunk || '?';
    var toks = lex(src, chunk);
    var p = 0;
    function peek() { return toks[p]; }
    function next() { return toks[p++]; }
    function check(t) { return toks[p].t === t; }
    function err(msg, tok) {
      tok = tok || toks[p];
      var near = tok.t === '<eof>' ? '<eof>' : (tok.v !== undefined ? tok.v : tok.t);
      throw new LuaSyntaxError(msg + " near '" + near + "'", chunk, tok.line);
    }
    function expect(t, what) {
      if (toks[p].t !== t) err("'" + t + "' expected" + (what ? ' (to close ' + what + ')' : ''));
      return toks[p++];
    }
    function accept(t) { if (toks[p].t === t) { p++; return true; } return false; }
    function name() {
      if (toks[p].t !== 'name') err('<name> expected');
      return toks[p++].v;
    }

    function blockFollow(withUntil) {
      var t = toks[p].t;
      return t === 'else' || t === 'elseif' || t === 'end' || t === '<eof>' || (withUntil && t === 'until');
    }

    function block() {
      var body = [];
      while (!blockFollow(true)) {
        if (check('return')) { body.push(retstat()); break; }
        var s = statement();
        if (s) body.push(s);
      }
      return body;
    }

    function retstat() {
      var tok = next();
      var exprs = [];
      if (!blockFollow(true) && !check(';')) exprs = exprlist();
      accept(';');
      return { k: 'Return', exprs: exprs, line: tok.line };
    }

    function statement() {
      var tok = peek(), line = tok.line;
      switch (tok.t) {
        case ';': next(); return null;
        case 'if': return ifstat();
        case 'while': {
          next(); var cond = expr(); expect('do'); var b = block(); expect('end', 'while');
          return { k: 'While', cond: cond, body: b, line: line };
        }
        case 'do': { next(); var b2 = block(); expect('end', 'do'); return { k: 'Do', body: b2, line: line }; }
        case 'for': return forstat();
        case 'repeat': {
          next(); var b3 = block(); expect('until', 'repeat'); var c3 = expr();
          return { k: 'Repeat', body: b3, cond: c3, line: line };
        }
        case 'function': {
          next();
          var target = { k: 'Name', name: name(), line: line }, isMethod = false;
          while (check('.') || check(':')) {
            var sep = next().t;
            var key = name();
            target = { k: 'Index', obj: target, key: { k: 'String', v: key }, line: line };
            if (sep === ':') { isMethod = true; break; }
          }
          var f = funcbody(isMethod, line);
          return { k: 'Assign', targets: [target], exprs: [f], line: line };
        }
        case 'local': {
          next();
          if (accept('function')) {
            var nm = name();
            return { k: 'LocalFunction', name: nm, func: funcbody(false, line), line: line };
          }
          var names = [], attribs = [];
          do {
            names.push(name());
            if (accept('<')) { attribs.push(name()); expect('>'); } else attribs.push(null);
          } while (accept(','));
          var exprs = accept('=') ? exprlist() : [];
          return { k: 'Local', names: names, attribs: attribs, exprs: exprs, line: line };
        }
        case '::': { next(); var label = name(); expect('::'); return { k: 'Label', name: label, line: line }; }
        case 'return': return retstat();
        case 'break': next(); return { k: 'Break', line: line };
        case 'goto': next(); return { k: 'Goto', name: name(), line: line };
        default: return exprstat();
      }
    }

    function ifstat() {
      var line = next().line;
      var clauses = [];
      var cond = expr(); expect('then');
      clauses.push({ cond: cond, body: block() });
      var orelse = null;
      for (;;) {
        if (accept('elseif')) { var c = expr(); expect('then'); clauses.push({ cond: c, body: block() }); }
        else if (accept('else')) { orelse = block(); expect('end', 'if'); break; }
        else { expect('end', 'if'); break; }
      }
      return { k: 'If', clauses: clauses, orelse: orelse, line: line };
    }

    function forstat() {
      var line = next().line;
      var n1 = name();
      if (accept('=')) {
        var start = expr(); expect(',');
        var limit = expr();
        var step = accept(',') ? expr() : null;
        expect('do'); var b = block(); expect('end', 'for');
        return { k: 'NumFor', name: n1, start: start, limit: limit, step: step, body: b, line: line };
      }
      var names = [n1];
      while (accept(',')) names.push(name());
      expect('in');
      var exprs = exprlist();
      expect('do'); var body = block(); expect('end', 'for');
      return { k: 'GenFor', names: names, exprs: exprs, body: body, line: line };
    }

    function exprstat() {
      var line = peek().line;
      var e = suffixedexp();
      if (check('=') || check(',')) {
        var targets = [e];
        while (accept(',')) targets.push(suffixedexp());
        expect('=');
        var exprs = exprlist();
        targets.forEach(function (t) { if (t.k !== 'Name' && t.k !== 'Index') err('syntax error'); });
        return { k: 'Assign', targets: targets, exprs: exprs, line: line };
      }
      if (e.k !== 'Call' && e.k !== 'Method') err('syntax error');
      return { k: 'ExprStat', expr: e, line: line };
    }

    function exprlist() {
      var list = [expr()];
      while (accept(',')) list.push(expr());
      return list;
    }

    function funcbody(isMethod, line) {
      var params = isMethod ? ['self'] : [], vararg = false;
      expect('(');
      if (!check(')')) {
        do {
          if (accept('...')) { vararg = true; break; }
          params.push(name());
        } while (accept(','));
      }
      expect(')');
      var b = block();
      var endTok = expect('end', 'function');
      return { k: 'Function', params: params, vararg: vararg, body: b, line: line, endLine: endTok.line };
    }

    function primaryexp() {
      var tok = peek();
      if (tok.t === 'name') { next(); return { k: 'Name', name: tok.v, line: tok.line }; }
      if (tok.t === '(') {
        next(); var e = expr(); expect(')');
        return { k: 'Paren', expr: e, line: tok.line };
      }
      err('unexpected symbol');
    }

    function suffixedexp() {
      var e = primaryexp();
      for (;;) {
        var tok = peek();
        switch (tok.t) {
          case '.': next(); e = { k: 'Index', obj: e, key: { k: 'String', v: name() }, line: tok.line }; break;
          case '[': next(); var key = expr(); expect(']'); e = { k: 'Index', obj: e, key: key, line: tok.line }; break;
          case ':': next(); var m = name(); e = { k: 'Method', obj: e, name: m, args: callargs(), line: tok.line }; break;
          case '(': case 'string': case '{': e = { k: 'Call', fn: e, args: callargs(), line: tok.line }; break;
          default: return e;
        }
      }
    }

    function callargs() {
      var tok = peek();
      if (tok.t === 'string') { next(); return [{ k: 'String', v: tok.v }]; }
      if (tok.t === '{') return [tablecons()];
      expect('(');
      if (accept(')')) return [];
      var args = exprlist();
      expect(')');
      return args;
    }

    function tablecons() {
      var line = expect('{').line;
      var items = [];   // { kind: 'pos'|'named'|'keyed', key, value }
      while (!check('}')) {
        if (check('name') && toks[p + 1].t === '=') {
          var key = next().v; next();
          items.push({ kind: 'keyed', key: { k: 'String', v: key }, value: expr() });
        } else if (check('[')) {
          next(); var k = expr(); expect(']'); expect('=');
          items.push({ kind: 'keyed', key: k, value: expr() });
        } else {
          items.push({ kind: 'pos', value: expr() });
        }
        if (!accept(',') && !accept(';')) break;
      }
      expect('}', 'table');
      return { k: 'Table', items: items, line: line };
    }

    function simpleexp() {
      var tok = peek();
      switch (tok.t) {
        case 'number': next(); return { k: 'Number', v: tok.v, line: tok.line };
        case 'string': next(); return { k: 'String', v: tok.v };
        case 'nil': next(); return { k: 'Nil' };
        case 'true': next(); return { k: 'True' };
        case 'false': next(); return { k: 'False' };
        case '...': next(); return { k: 'Vararg', line: tok.line };
        case '{': return tablecons();
        case 'function': next(); return funcbody(false, tok.line);
        default: return suffixedexp();
      }
    }

    function expr(limit) {
      limit = limit || 0;
      var left, tok = peek();
      if (tok.t === 'not' || tok.t === '-' || tok.t === '#' || tok.t === '~') {
        next();
        left = { k: 'Unop', op: tok.t, expr: expr(UNARY_PRIORITY), line: tok.line };
      } else {
        left = simpleexp();
      }
      for (;;) {
        var op = peek().t, pr = BINARY[op];
        if (!pr || pr[0] <= limit) break;
        var line = next().line;
        var right = expr(pr[1]);
        left = { k: 'Binop', op: op, left: left, right: right, line: line };
      }
      return left;
    }

    var body = block();
    if (!check('<eof>')) err("'<eof>' expected");
    return { k: 'Chunk', body: body };
  }

  NS.lex = lex;
  NS.parse = parse;
  NS.LuaSyntaxError = LuaSyntaxError;
  NS.utf8Bytes = utf8Bytes;
})(typeof module === 'object' && module.exports
  ? (module.exports = (globalThis.MiddawLua = globalThis.MiddawLua || {}))
  : (globalThis.MiddawLua = globalThis.MiddawLua || {}));


/* ---- kit/runtime/lua_runtime.js ---- */
/* Middaw's Lua 5.4, part 3 of 3: values, operators and the standard library.
 *
 * Values, as JavaScript sees them:
 *   nil      undefined
 *   boolean  true / false
 *   number   a JS number. An integral JS number is a Lua *integer*; a
 *            non-integral one (or inf, nan) is a Lua *float*. A float whose
 *            value happens to be integral (4.0, 2/2) is an LFloat, so that it
 *            still prints "4.0" and math.type still says "float".
 *   string   a JS string with one character per byte (0-255)
 *   table    LuaTable
 *   function a JS function: Lua arguments in, and undefined, one value, or a
 *            Multi for two or more results.
 *
 * Wherever the result has to match the real Lua byte for byte - table.sort
 * with ties, the pattern matcher, math.random, number formatting - the code
 * is a port of Lua 5.4's own C, not a lookalike.
 */
(function (NS) {
  'use strict';

  // ------------------------------------------------------------ values ----
  function LFloat(n) { this.n = n; }
  LFloat.prototype.valueOf = function () { return this.n; };

  function mkf(x) { return Number.isInteger(x) ? new LFloat(x) : x; }
  function isNum(v) { return typeof v === 'number' || v instanceof LFloat; }
  function num(v) { return typeof v === 'number' ? v : v.n; }
  function isFloatVal(v) { return v instanceof LFloat || (typeof v === 'number' && !Number.isInteger(v)); }

  function Multi(a) { this.a = a; }
  function first(v) { return v instanceof Multi ? v.a[0] : v; }
  // `return` with no values gives NONE; a bare undefined is one nil.
  var NONE = new Multi([]);
  var NIL1 = Object.freeze([undefined]);
  function sp(v) {
    if (v instanceof Multi) return v.a;
    return v === undefined ? NIL1 : [v];
  }
  function ret(list) {
    if (list.length === 0) return NONE;
    if (list.length === 1) return list[0];
    return new Multi(list);
  }

  var tableIds = 0;
  function LuaTable() { this.arr = []; this.hash = null; this.mt = null; this.id = 0; this.hver = 0; }
  LuaTable.prototype.get = function (k) {
    if (typeof k === 'number') {
      var a = this.arr;
      if (k > 0 && k <= a.length && Number.isInteger(k)) return a[k - 1];
    } else if (typeof k === 'string') {
      return this.hash === null ? undefined : this.hash.get(k);
    } else if (k instanceof LFloat) {
      return this.get(k.n);
    }
    return this.hash === null ? undefined : this.hash.get(k);
  };
  LuaTable.prototype.set = function (k, v) {
    if (typeof k === 'number') {
      if (Number.isInteger(k) && k > 0) {
        var a = this.arr, n = a.length;
        if (k <= n) {
          a[k - 1] = v;
          if (v === undefined && k === n) { while (a.length && a[a.length - 1] === undefined) a.pop(); }
          return;
        }
        if (k === n + 1) {
          if (v === undefined) { if (this.hash !== null) this.hash.delete(k); return; }
          a.push(v);
          if (this.hash !== null && this.hash.size) {
            var h = this.hash;
            while (h.has(a.length + 1)) { var nk = a.length + 1; a.push(h.get(nk)); h.delete(nk); }
          }
          return;
        }
      } else if (k !== k) {
        throw rterror('table index is NaN');
      }
    } else if (k instanceof LFloat) {
      return this.set(k.n, v);
    } else if (k === undefined) {
      throw rterror('table index is nil');
    }
    if (v === undefined) { if (this.hash !== null) this.hash.delete(k); return; }
    if (this.hash === null) this.hash = new Map();
    if (!this.hash.has(k)) this.hver++;
    this.hash.set(k, v);
  };
  LuaTable.prototype.length = function () { return this.arr.length; };

  // ------------------------------------------------------------ errors ----
  // Compiled chunks register their line maps here, so an error can say
  // "gi_idea.lua:1234:" as the real Lua would.
  var lineMaps = {};
  function luaPosition(level) {
    var stack = new Error().stack || '';
    var re = /lua:([^:\s()]+):(\d+):\d+/g, m, found = 0;
    while ((m = re.exec(stack)) !== null) {
      found++;
      if (found >= level) {
        var map = lineMaps[m[1]];
        var line = map ? map[Number(m[2]) - 1] : undefined;
        if (line) return m[1] + ':' + line + ': ';
        return m[1] + ': ';
      }
    }
    return '';
  }
  function LuaError(value, traceback) {
    this.value = value;
    this.message = typeof value === 'string' ? value : tostring(value);
    this.luaTraceback = traceback;
    this.stack = new Error().stack;
  }
  LuaError.prototype = Object.create(Error.prototype);
  LuaError.prototype.name = 'LuaError';
  function rterror(msg) { return new LuaError(luaPosition(1) + msg); }

  function typeName(v) {
    if (v === undefined || v === null) return 'nil';
    switch (typeof v) {
      case 'boolean': return 'boolean';
      case 'number': return 'number';
      case 'string': return 'string';
      case 'function': return 'function';
    }
    if (v instanceof LFloat) return 'number';
    if (v instanceof LuaTable) return 'table';
    return 'userdata';
  }

  // --------------------------------------------------------- numbers ----
  // Exact decimal expansion of a double: x = D * 10^-s, D a BigInt.
  var F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
  function exactDecimal(x) {
    F64[0] = x;
    var hi = U32[1], lo = U32[0];
    var exp = (hi >>> 20) & 0x7ff;
    var mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    if (exp === 0) exp = 1; else mant |= 1n << 52n;
    var e = exp - 1075;
    if (e >= 0) return { D: mant << BigInt(e), s: 0 };
    return { D: mant * (5n ** BigInt(-e)), s: -e };
  }
  function roundDiv(N, div) {      // round N/div half to even
    var q = N / div, r = N % div;
    var twice = r * 2n;
    if (twice > div || (twice === div && (q & 1n) === 1n)) q += 1n;
    return q;
  }
  function fixedDigits(x, f) {     // |x| to f decimals, C-exact; returns string
    var ex = exactDecimal(Math.abs(x));
    var q;
    if (f >= ex.s) q = ex.D * (10n ** BigInt(f - ex.s));
    else q = roundDiv(ex.D, 10n ** BigInt(ex.s - f));
    var s = q.toString();
    if (f === 0) return s;
    while (s.length <= f) s = '0' + s;
    return s.slice(0, s.length - f) + '.' + s.slice(s.length - f);
  }
  function expDigits(x, prec) {    // |x| as d.ddd with prec decimals; returns [mantissa, exponent]
    if (x === 0) return [prec > 0 ? '0.' + '0'.repeat(prec) : '0', 0];
    var ex = exactDecimal(Math.abs(x));
    var D = ex.D.toString();
    var X = D.length - 1 - ex.s;
    var P = prec + 1, q;
    if (D.length > P) {
      q = roundDiv(ex.D, 10n ** BigInt(D.length - P)).toString();
      if (q.length > P) { q = q.slice(0, P); X++; }
    } else q = D + '0'.repeat(P - D.length);
    return [prec > 0 ? q[0] + '.' + q.slice(1) : q, X];
  }
  function fmtExp(x, prec, upper) {
    var r = expDigits(x, prec);
    var X = r[1];
    var s = r[0] + (upper ? 'E' : 'e') + (X < 0 ? '-' : '+') + (Math.abs(X) < 10 ? '0' : '') + Math.abs(X);
    return s;
  }
  function stripZeros(s) {
    if (s.indexOf('.') < 0) return s;
    s = s.replace(/0+$/, '');
    return s.replace(/\.$/, '');
  }
  function fmtG(x, P, upper, alt) {   // C's %g of |x|
    if (P === 0) P = 1;
    if (x === 0) return '0';
    var X = expDigits(x, P - 1)[1];
    var s;
    if (X < -4 || X >= P) {
      var r = expDigits(x, P - 1);
      var m = alt ? r[0] : stripZeros(r[0]);
      s = m + (upper ? 'E' : 'e') + (r[1] < 0 ? '-' : '+') + (Math.abs(r[1]) < 10 ? '0' : '') + Math.abs(r[1]);
    } else {
      s = fixedDigits(x, P - 1 - X);
      if (!alt) s = stripZeros(s);
    }
    return s;
  }
  function floatStr(x) {
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (x !== x) return (1 / x) < 0 ? 'nan' : '-nan';
    var neg = x < 0 || (x === 0 && 1 / x < 0);
    var s = (neg ? '-' : '') + fmtG(x, 14, false, false);
    if (/^-?\d+$/.test(s)) s += '.0';
    return s;
  }
  function intStr(n) {
    if (Math.abs(n) <= 9007199254740992) return String(n === 0 ? 0 : n);
    return BigInt(n).toString();
  }
  // io.write prints a float with LUA_NUMBER_FMT alone: 1.0 is "1".
  function writeNum(v) {
    if (!isNum(v)) throw rterror('bad argument to \'write\' (string expected, got ' + typeName(v) + ')');
    if (typeof v === 'number' && Number.isInteger(v)) return intStr(v);
    var x = num(v);
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (x !== x) return '-nan';
    return (x < 0 || (x === 0 && 1 / x < 0) ? '-' : '') + fmtG(Math.abs(x), 14, false, false);
  }
  function numStr(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? intStr(v) : floatStr(v);
    return floatStr(v.n);
  }

  // lua_stringtonumber: a whole numeral, spaces either side, or undefined.
  function str2num(s) {
    var t = s.replace(/^[ \f\n\r\t\v]+|[ \f\n\r\t\v]+$/g, '');
    var m;
    if ((m = /^([+-])?0[xX]([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?(?:[pP]([+-]?\d+))?$/.exec(t))) {
      var ip = m[2], fp = m[3], ex = m[4];
      if (!ip && !fp) return undefined;
      var neg = m[1] === '-';
      if (fp === undefined && ex === undefined) {
        var big = BigInt.asIntN(64, BigInt('0x' + ip));
        var n = Number(big);
        return neg ? 0 - n : n;
      }
      var val = 0;
      for (var i = 0; i < ip.length; i++) val = val * 16 + parseInt(ip[i], 16);
      var scale = 1 / 16;
      fp = fp || '';
      for (var j = 0; j < fp.length; j++) { val += parseInt(fp[j], 16) * scale; scale /= 16; }
      if (ex) val *= Math.pow(2, Number(ex));
      return mkf(neg ? -val : val);
    }
    if ((m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.exec(t))) {
      var isInt = m[1].indexOf('.') < 0 && !m[2];
      var v = Number(t);
      if (isInt) {
        if (Math.abs(v) <= 9223372036854775807) return v;
        return mkf(v);
      }
      return mkf(v);
    }
    return undefined;
  }

  function toNumberArith(v, op) {
    if (typeof v === 'number') return v;
    if (v instanceof LFloat) return v;
    if (typeof v === 'string') { var n = str2num(v); if (n !== undefined) return n; }
    return null;
  }
  function arithError(op, a, b) {
    var bad = (isNum(a) || (typeof a === 'string' && str2num(a) !== undefined)) ? b : a;
    if (op === 'concat') return rterror('attempt to concatenate a ' + typeName(bad) + ' value');
    if (op === 'bit') return rterror('attempt to perform bitwise operation on a ' + typeName(bad) + ' value');
    return rterror('attempt to perform arithmetic on a ' + typeName(bad) + ' value');
  }
  function metaOf(v) {
    if (v instanceof LuaTable) return v.mt;
    if (typeof v === 'string') return stringMeta;
    return null;
  }
  function metaBin(ev, a, b) {
    var mt = metaOf(a), h = mt && mt.get(ev);
    if (h === undefined) { mt = metaOf(b); h = mt && mt.get(ev); }
    if (h === undefined || h === null) return NOMETA;
    return first(call(h)(a, b));
  }
  var NOMETA = {};

  function arithSlow(op, a, b, ev) {
    var x = toNumberArith(a), y = toNumberArith(b);
    if (x === null || y === null) {
      var r = metaBin(ev, a, b);
      if (r !== NOMETA) return r;
      throw arithError(op, a, b);
    }
    switch (op) {
      case 'add': return add(x, y);
      case 'sub': return sub(x, y);
      case 'mul': return mul(x, y);
      case 'div': return div(x, y);
      case 'mod': return mod(x, y);
      case 'idiv': return idiv(x, y);
      case 'pow': return pow(x, y);
    }
  }
  function add(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      var r = a + b;
      return (Number.isInteger(a) && Number.isInteger(b)) ? r : mkf(r);
    }
    if (isNum(a) && isNum(b)) return mkf(num(a) + num(b));
    return arithSlow('add', a, b, '__add');
  }
  function sub(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      var r = a - b;
      return (Number.isInteger(a) && Number.isInteger(b)) ? r : mkf(r);
    }
    if (isNum(a) && isNum(b)) return mkf(num(a) - num(b));
    return arithSlow('sub', a, b, '__sub');
  }
  function mul(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      var r = a * b;
      if (Number.isInteger(a) && Number.isInteger(b)) return r === 0 ? 0 : r;
      return mkf(r);
    }
    if (isNum(a) && isNum(b)) return mkf(num(a) * num(b));
    return arithSlow('mul', a, b, '__mul');
  }
  function div(a, b) {
    if (isNum(a) && isNum(b)) return mkf(num(a) / num(b));
    return arithSlow('div', a, b, '__div');
  }
  function idiv(a, b) {
    if (typeof a === 'number' && typeof b === 'number' && Number.isInteger(a) && Number.isInteger(b)) {
      if (b === 0) throw rterror("attempt to perform 'n//0'");
      var q = Math.floor(a / b);
      return q === 0 ? 0 : q;
    }
    if (isNum(a) && isNum(b)) return mkf(Math.floor(num(a) / num(b)));
    return arithSlow('idiv', a, b, '__idiv');
  }
  function mod(a, b) {
    if (typeof a === 'number' && typeof b === 'number' && Number.isInteger(a) && Number.isInteger(b)) {
      if (b === 0) throw rterror("attempt to perform 'n%%0'");
      var r = a % b;
      if (r !== 0 && (r < 0) !== (b < 0)) r += b;
      return r === 0 ? 0 : r;
    }
    if (isNum(a) && isNum(b)) {
      var x = num(a), y = num(b);
      var m;
      if (y === Infinity || y === -Infinity) m = x;
      else m = x % y;
      if ((m > 0) ? y < 0 : (m < 0 && y !== m)) m += y;
      return mkf(m);
    }
    return arithSlow('mod', a, b, '__mod');
  }
  function pow(a, b) {
    if (isNum(a) && isNum(b)) return mkf(Math.pow(num(a), num(b)));
    return arithSlow('pow', a, b, '__pow');
  }
  function unm(a) {
    if (typeof a === 'number') return Number.isInteger(a) ? 0 - a : -a;
    if (a instanceof LFloat) return new LFloat(-a.n);
    var x = toNumberArith(a);
    if (x !== null) return unm(x);
    var mt = metaOf(a), h = mt && mt.get('__unm');
    if (h !== undefined && h !== null) return first(call(h)(a, a));
    throw rterror('attempt to perform arithmetic on a ' + typeName(a) + ' value');
  }

  // Bitwise operations work on 64-bit integers.
  function toInt64(v, a, b) {
    var x = typeof v === 'string' ? str2num(v) : v;
    if (typeof x === 'number' && Number.isInteger(x)) return BigInt(x);
    if (x instanceof LFloat) return BigInt(x.n);
    if (typeof x === 'number') throw rterror('number has no integer representation');
    throw arithError('bit', a, b);
  }
  function fromInt64(big) { return Number(BigInt.asIntN(64, big)); }
  function small(a, b) {
    return typeof a === 'number' && typeof b === 'number' && (a | 0) === a && (b | 0) === b;
  }
  function band(a, b) { if (small(a, b)) return a & b; return bitSlow('__band', a, b, function (x, y) { return x & y; }); }
  function bor(a, b) { if (small(a, b)) return a | b; return bitSlow('__bor', a, b, function (x, y) { return x | y; }); }
  function bxor(a, b) { if (small(a, b)) return a ^ b; return bitSlow('__bxor', a, b, function (x, y) { return x ^ y; }); }
  function shiftLeft(x, n) {
    if (n <= -64n || n >= 64n) return 0n;
    if (n >= 0n) return BigInt.asUintN(64, x << n);
    return BigInt.asUintN(64, x) >> (-n);
  }
  function shl(a, b) { return bitSlow('__shl', a, b, function (x, y) { return shiftLeft(x, y); }); }
  function shr(a, b) { return bitSlow('__shr', a, b, function (x, y) { return shiftLeft(x, -y); }); }
  function bnot(a) {
    if (typeof a === 'number' && (a | 0) === a) return ~a;
    var mt = metaOf(a), h = mt && mt.get('__bnot');
    if (h !== undefined && h !== null && !isNum(a)) return first(call(h)(a, a));
    return fromInt64(~toInt64(a, a, a));
  }
  function bitSlow(ev, a, b, f) {
    if (!((isNum(a) || typeof a === 'string') && (isNum(b) || typeof b === 'string'))) {
      var r = metaBin(ev, a, b);
      if (r !== NOMETA) return r;
    }
    return fromInt64(f(toInt64(a, a, b), toInt64(b, a, b)));
  }

  function concat(a, b) {
    var ta = typeof a, tb = typeof b;
    if (ta === 'string' && tb === 'string') return a + b;
    if ((ta === 'string' || isNum(a)) && (tb === 'string' || isNum(b))) {
      return (ta === 'string' ? a : numStr(a)) + (tb === 'string' ? b : numStr(b));
    }
    var r = metaBin('__concat', a, b);
    if (r !== NOMETA) return r;
    throw arithError('concat', a, b);
  }

  function len(v) {
    if (typeof v === 'string') return v.length;
    if (v instanceof LuaTable) {
      if (v.mt !== null) {
        var h = v.mt.get('__len');
        if (h !== undefined) return first(call(h)(v));
      }
      return v.arr.length;
    }
    var mt = metaOf(v), h2 = mt && mt.get('__len');
    if (h2 !== undefined && h2 !== null) return first(call(h2)(v));
    throw rterror('attempt to get length of a ' + typeName(v) + ' value');
  }

  function eq(a, b) {
    if (a === b) return true;
    var ta = typeof a, tb = typeof b;
    if (ta === 'object' || tb === 'object') {
      if (isNum(a) && isNum(b)) return num(a) === num(b);
      if (a instanceof LuaTable && b instanceof LuaTable) {
        var h = (a.mt && a.mt.get('__eq')) || (b.mt && b.mt.get('__eq'));
        if (h) return truthy(first(call(h)(a, b)));
      }
    }
    return false;
  }
  function lt(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a < b;
    if (isNum(a) && isNum(b)) return num(a) < num(b);
    if (typeof a === 'string' && typeof b === 'string') return a < b;
    var r = metaBin('__lt', a, b);
    if (r !== NOMETA) return truthy(r);
    throw compareError(a, b);
  }
  function le(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a <= b;
    if (isNum(a) && isNum(b)) return num(a) <= num(b);
    if (typeof a === 'string' && typeof b === 'string') return a <= b;
    var r = metaBin('__le', a, b);
    if (r !== NOMETA) return truthy(r);
    throw compareError(a, b);
  }
  function gt(a, b) { return lt(b, a); }
  function ge(a, b) { return le(b, a); }
  function compareError(a, b) {
    var t1 = typeName(a), t2 = typeName(b);
    if (t1 === t2) return rterror('attempt to compare two ' + t1 + ' values');
    return rterror('attempt to compare ' + t1 + ' with ' + t2);
  }
  function truthy(v) { return v !== undefined && v !== false && v !== null; }

  // ------------------------------------------------------- indexing ----
  function index(o, k, desc) {
    if (o instanceof LuaTable) {
      var v = o.get(k);
      if (v !== undefined || o.mt === null) return v;
      return metaIndex(o, k, desc);
    }
    if (typeof o === 'string') return stringLib.get(k);
    return metaIndex(o, k, desc);
  }
  function metaIndex(o, k, desc) {
    for (var loop = 0; loop < 100; loop++) {
      var h;
      if (o instanceof LuaTable) {
        var v = o.get(k);
        if (v !== undefined) return v;
        if (o.mt === null) return undefined;
        h = o.mt.get('__index');
        if (h === undefined) return undefined;
      } else {
        var mt = metaOf(o);
        h = mt && mt.get('__index');
        if (h === undefined || h === null) {
          throw rterror('attempt to index a ' + typeName(o) + ' value' + (desc ? ' (' + desc + ')' : ''));
        }
      }
      if (typeof h === 'function') return first(h(o, k));
      o = h;
    }
    throw rterror("'__index' chain too long; possible loop");
  }
  function setindex(o, k, v, desc) {
    if (o instanceof LuaTable) {
      if (o.mt === null) { o.set(k, v); return; }
      var h = o.mt.get('__newindex');
      if (h === undefined || o.get(k) !== undefined) { o.set(k, v); return; }
      if (typeof h === 'function') { h(o, k, v); return; }
      return setindex(h, k, v);
    }
    throw rterror('attempt to index a ' + typeName(o) + ' value' + (desc ? ' (' + desc + ')' : ''));
  }

  function call(f, desc) {
    if (typeof f === 'function') return f;
    var mt = metaOf(f), h = mt && mt.get('__call');
    if (typeof h === 'function') return function () {
      var args = [f];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      return h.apply(null, args);
    };
    throw rterror('attempt to call a ' + typeName(f) + ' value' + (desc ? ' (' + desc + ')' : ''));
  }
  function method(o, name) {
    var f = index(o, name, 'method \'' + name + '\'');
    if (typeof f !== 'function') f = call(f, "method '" + name + "'");
    var args = [o];
    for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
    return f.apply(null, args);
  }

  function tbl(list, keyed) {
    var t = new LuaTable();
    if (list.length) {
      var a = list.slice();
      while (a.length && a[a.length - 1] === undefined) a.pop();
      t.arr = a;
    }
    if (keyed) {
      for (var i = 0; i < keyed.length; i += 2) {
        if (keyed[i] === undefined) throw rterror('table index is nil');
        if (keyed[i + 1] !== undefined) t.set(keyed[i], keyed[i + 1]);
      }
    }
    return t;
  }

  // ------------------------------------------------------- iteration ----
  function IpairsIter(t) { this.t = t; this.i = 0; this.a = undefined; this.b = undefined; }
  IpairsIter.prototype.step = function () {
    var i = this.i + 1, v = this.t.get(i);
    if (v === undefined) return false;
    this.i = i; this.a = i; this.b = v; return true;
  };
  function PairsIter(t) { this.t = t; this.i = 0; this.it = null; this.a = undefined; this.b = undefined; }
  PairsIter.prototype.step = function () {
    var arr = this.t.arr;
    while (this.it === null && this.i < arr.length) {
      var v = arr[this.i++];
      if (v !== undefined) { this.a = this.i; this.b = v; return true; }
    }
    if (this.it === null) {
      if (this.t.hash === null) return false;
      this.it = this.t.hash.entries();
    }
    var n = this.it.next();
    if (n.done) return false;
    this.a = n.value[0]; this.b = n.value[1];
    return true;
  };
  function GenIter(f, s, c) { this.f = call(f, 'for iterator'); this.s = s; this.c = c; this.a = undefined; this.b = undefined; this.v = NONE; }
  GenIter.prototype.step = function () {
    var r = this.f(this.s, this.c);
    var v = r instanceof Multi ? r.a : [r];
    if (v[0] === undefined) return false;
    this.c = v[0]; this.a = v[0]; this.b = v[1]; this.v = v;
    return true;
  };
  function iter(f, s, c) {
    if (f === ipairsAux && s instanceof LuaTable && s.mt === null) return new IpairsIter(s);
    if (f === luaNext && s instanceof LuaTable && c === undefined && s.mt === null) return new PairsIter(s);
    return new GenIter(f, s, c);
  }

  function forprep(a, b, c) {
    if (c === undefined) c = 1;
    if (!isNum(a)) throw rterror("'for' initial value must be a number");
    if (!isNum(b)) throw rterror("'for' limit must be a number");
    if (!isNum(c)) throw rterror("'for' step must be a number");
    var x = num(a), lim = num(b), st = num(c);
    if (st === 0) throw rterror("'for' step is zero");
    var intLoop = typeof a === 'number' && Number.isInteger(a) && typeof c === 'number' && Number.isInteger(c);
    if (intLoop) {
      if (!(typeof b === 'number' && Number.isInteger(b))) {
        if (lim !== lim) return [1, 0, 1, false];
        lim = st > 0 ? Math.floor(lim) : Math.ceil(lim);
      }
      return [x, lim, st, false];
    }
    return [x, lim, st, true];
  }

  // ------------------------------------------------------- tostring ----
  function tostring(v) {
    if (v === undefined || v === null) return 'nil';
    switch (typeof v) {
      case 'string': return v;
      case 'number': return numStr(v);
      case 'boolean': return v ? 'true' : 'false';
      case 'function': return 'function: ' + addressOf(v);
    }
    if (v instanceof LFloat) return floatStr(v.n);
    if (v instanceof LuaTable) {
      if (v.mt !== null) {
        var h = v.mt.get('__tostring');
        if (h !== undefined) {
          var s = first(call(h)(v));
          if (typeof s !== 'string') throw rterror("'__tostring' must return a string");
          return s;
        }
        var nm = v.mt.get('__name');
        if (typeof nm === 'string') return nm + ': ' + addressOf(v);
      }
      return 'table: ' + addressOf(v);
    }
    return 'userdata: ' + addressOf(v);
  }
  var addresses = new WeakMap(), nextAddress = 0x55d0c0de0000;
  function addressOf(o) {
    var a = addresses.get(o);
    if (a === undefined) { a = nextAddress; nextAddress += 0x40; addresses.set(o, a); }
    return '0x' + a.toString(16).padStart(14, '0');
  }

  // ===================================================== the library ======
  function argError(n, fname, msg) { return rterror("bad argument #" + n + " to '" + fname + "' (" + msg + ')'); }
  function checkTable(v, n, fname) {
    if (!(v instanceof LuaTable)) throw argError(n, fname, 'table expected, got ' + typeNameArg(v));
    return v;
  }
  function typeNameArg(v) { return v === undefined ? 'no value' : typeName(v); }
  function checkInt(v, n, fname) {
    if (typeof v === 'number' && Number.isInteger(v)) return v;
    if (v instanceof LFloat) return v.n;
    if (typeof v === 'string') { var x = str2num(v); if (x !== undefined) return checkInt(x, n, fname); }
    if (typeof v === 'number') throw argError(n, fname, 'number has no integer representation');
    throw argError(n, fname, 'number expected, got ' + typeNameArg(v));
  }
  function optInt(v, n, fname, d) { return v === undefined ? d : checkInt(v, n, fname); }
  function checkNum(v, n, fname) {
    if (typeof v === 'number') return v;
    if (v instanceof LFloat) return v.n;
    if (typeof v === 'string') { var x = str2num(v); if (x !== undefined) return num(x); }
    throw argError(n, fname, 'number expected, got ' + typeNameArg(v));
  }
  function checkStr(v, n, fname) {
    if (typeof v === 'string') return v;
    if (isNum(v)) return numStr(v);
    throw argError(n, fname, 'string expected, got ' + typeNameArg(v));
  }

  function rawLen(t) { return t instanceof LuaTable ? t.arr.length : (typeof t === 'string' ? t.length : 0); }

  // ---------------------------------------------------------- base ------
  function luaNext(t, k) {
    checkTable(t, 1, 'next');
    var arr = t.arr, i = 0;
    if (k !== undefined) {
      if (typeof k === 'number' && Number.isInteger(k) && k >= 1 && k <= arr.length) i = k;
      else if (k instanceof LFloat && k.n >= 1 && k.n <= arr.length) i = k.n;
      else i = -1;
    }
    if (i >= 0) {
      for (; i < arr.length; i++) if (arr[i] !== undefined) return new Multi([i + 1, arr[i]]);
      if (t.hash === null) return undefined;
      var it = t.hash.entries().next();
      return it.done ? undefined : new Multi([it.value[0], it.value[1]]);
    }
    if (t.hash === null) throw rterror("invalid key to 'next'");
    if (t._nkver !== t.hver || !t._nk) {
      t._nk = Array.from(t.hash.keys());
      t._nki = new Map();
      for (var j = 0; j < t._nk.length; j++) t._nki.set(t._nk[j], j);
      t._nkver = t.hver;
    }
    var key = k instanceof LFloat ? k.n : k;
    var pos = t._nki.get(key);
    if (pos === undefined) throw rterror("invalid key to 'next'");
    for (pos++; pos < t._nk.length; pos++) {
      var kk = t._nk[pos];
      if (t.hash.has(kk)) return new Multi([kk, t.hash.get(kk)]);
    }
    return undefined;
  }
  function ipairsAux(t, i) {
    i = i + 1;
    var v = index(t, i);
    return v === undefined ? undefined : new Multi([i, v]);
  }

  function makeEnv(host) {
    host = host || {};
    var G = new LuaTable();
    function reg(t, name, f) { t.set(name, f); }

    reg(G, 'print', function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) parts.push(tostring(arguments[i]));
      (host.print || function (s) { console.log(s); })(parts.join('\t'));
      return NONE;
    });
    reg(G, 'type', function (v) {
      if (arguments.length === 0) throw argError(1, 'type', 'value expected');
      return typeName(v);
    });
    reg(G, 'tostring', function (v) { return tostring(v); });
    reg(G, 'tonumber', function (v, base) {
      if (base === undefined) {
        if (isNum(v)) return v;
        if (typeof v === 'string') return str2num(v);
        if (arguments.length === 0) throw argError(1, 'tonumber', 'value expected');
        return undefined;
      }
      var b = checkInt(base, 2, 'tonumber');
      var s = checkStr(v, 1, 'tonumber').replace(/^\s+|\s+$/g, '').toLowerCase();
      var neg = false;
      if (s[0] === '-') { neg = true; s = s.slice(1); }
      if (!s.length) return undefined;
      var n = 0;
      for (var i = 0; i < s.length; i++) {
        var c = s.charCodeAt(i);
        var d = c >= 48 && c <= 57 ? c - 48 : (c >= 97 && c <= 122 ? c - 87 : 99);
        if (d >= b) return undefined;
        n = n * b + d;
      }
      return neg ? -n : n;
    });
    reg(G, 'ipairs', function (t) {
      if (arguments.length === 0) throw argError(1, 'ipairs', 'table expected, got no value');
      return new Multi([ipairsAux, t, 0]);
    });
    reg(G, 'pairs', function (t) {
      if (t instanceof LuaTable && t.mt !== null) {
        var h = t.mt.get('__pairs');
        if (h !== undefined) { var r = sp(call(h)(t)); return new Multi([r[0], r[1], r[2]]); }
      }
      checkTable(t, 1, 'pairs');
      return new Multi([luaNext, t, undefined]);
    });
    reg(G, 'next', luaNext);
    reg(G, 'select', function (n) {
      var count = arguments.length - 1;
      if (n === '#') return count;
      var i = checkInt(n, 1, 'select');
      if (i < 0) i = count + i; else if (i === 0) throw argError(1, 'select', 'index out of range');
      else i = i - 1;
      if (i < 0) throw argError(1, 'select', 'index out of range');
      var out = [];
      for (var j = i + 1; j < arguments.length; j++) out.push(arguments[j]);
      return ret(out);
    });
    reg(G, 'rawget', function (t, k) { checkTable(t, 1, 'rawget'); return t.get(k); });
    reg(G, 'rawset', function (t, k, v) { checkTable(t, 1, 'rawset'); t.set(k, v); return t; });
    reg(G, 'rawequal', function (a, b) { return a === b || (isNum(a) && isNum(b) && num(a) === num(b)); });
    reg(G, 'rawlen', function (t) { return rawLen(t); });
    reg(G, 'setmetatable', function (t, mt) {
      checkTable(t, 1, 'setmetatable');
      if (t.mt && t.mt.get('__metatable') !== undefined) throw rterror('cannot change a protected metatable');
      t.mt = mt === undefined ? null : mt;
      return t;
    });
    reg(G, 'getmetatable', function (v) {
      var mt = metaOf(v);
      if (!mt) return undefined;
      var p = mt.get('__metatable');
      return p !== undefined ? p : mt;
    });
    reg(G, 'assert', function (v, msg) {
      if (truthy(v)) { return ret(Array.prototype.slice.call(arguments)); }
      if (arguments.length < 1) throw argError(1, 'assert', 'value expected');
      throw new LuaError(arguments.length >= 2 ? msg : 'assertion failed!');
    });
    reg(G, 'error', function (v, level) {
      var lv = level === undefined ? 1 : num(level);
      if (typeof v === 'string' && lv > 0) v = luaPosition(lv + 1) + v;
      throw new LuaError(v);
    });
    reg(G, 'pcall', function (f) {
      var args = Array.prototype.slice.call(arguments, 1);
      try {
        var r = call(f).apply(null, args);
        return new Multi([true].concat(sp(r)));
      } catch (e) {
        return new Multi([false, errorValue(e)]);
      }
    });
    reg(G, 'xpcall', function (f, handler) {
      var args = Array.prototype.slice.call(arguments, 2);
      try {
        var r = call(f).apply(null, args);
        return new Multi([true].concat(sp(r)));
      } catch (e) {
        return new Multi([false].concat(sp(call(handler)(errorValue(e)))));
      }
    });
    reg(G, 'collectgarbage', function (opt) { return opt === 'count' ? mkf(1024) : 0; });
    reg(G, 'load', function (chunk, name, mode, env) {
      var src = chunk;
      if (typeof chunk === 'function') {
        var pieces = [], piece;
        while ((piece = first(chunk())) !== undefined && piece !== '') pieces.push(piece);
        src = pieces.join('');
      }
      try {
        return NS.load(src, typeof name === 'string' ? name.replace(/^[=@]/, '') : 'chunk', env || G);
      } catch (e) {
        return new Multi([undefined, errorValue(e)]);
      }
    });
    reg(G, 'loadfile', function (path, mode, env) {
      var src = host.readFile ? host.readFile(path) : null;
      if (src === null || src === undefined) return new Multi([undefined, 'cannot open ' + path]);
      try { return NS.load(src, path, env || G); }
      catch (e) { return new Multi([undefined, errorValue(e)]); }
    });
    reg(G, 'dofile', function (path) {
      var src = host.readFile ? host.readFile(path) : null;
      if (src === null || src === undefined) throw rterror('cannot open ' + path);
      return NS.load(src, path, G)();
    });
    reg(G, 'require', function (name) {
      var loaded = G.get('package').get('loaded');
      var v = loaded.get(name);
      if (v !== undefined) return v;
      if (!host.require) throw rterror("module '" + name + "' not found");
      v = host.require(name);
      loaded.set(name, v === undefined ? true : v);
      return v === undefined ? true : v;
    });
    var pkg = new LuaTable(); pkg.set('loaded', new LuaTable()); pkg.set('path', './?.lua');
    G.set('package', pkg);
    G.set('_G', G);
    G.set('_VERSION', 'Lua 5.4');

    G.set('string', stringLib);
    G.set('table', makeTableLib());
    G.set('math', makeMathLib());
    G.set('os', makeOsLib(host));
    G.set('io', makeIoLib(host));
    G.set('utf8', makeUtf8Lib());
    pkg.get('loaded').set('string', stringLib);
    pkg.get('loaded').set('_G', G);
    return G;
  }
  function errorValue(e) {
    if (e instanceof LuaError) return e.value;
    if (e instanceof RangeError) return 'stack overflow';
    if (e && e.name === 'LuaSyntaxError') return e.message;
    return String(e && e.message ? e.message : e);
  }

  // --------------------------------------------------------- table ------
  function makeTableLib() {
    var T = new LuaTable();
    T.set('insert', function (t, a, b) {
      checkTable(t, 1, 'insert');
      var e = len(t) + 1;
      if (arguments.length === 2) { setindex(t, e, a); return NONE; }
      if (arguments.length !== 3) throw rterror("wrong number of arguments to 'insert'");
      var pos = checkInt(a, 2, 'insert');
      if (pos < 1 || pos > e) throw argError(2, 'insert', 'position out of bounds');
      if (t.mt === null && e - 1 === t.arr.length) {
        t.arr.splice(pos - 1, 0, b);
        if (b === undefined) { while (t.arr.length && t.arr[t.arr.length - 1] === undefined) t.arr.pop(); }
        return NONE;
      }
      for (var i = e; i > pos; i--) setindex(t, i, index(t, i - 1));
      setindex(t, pos, b);
      return NONE;
    });
    T.set('remove', function (t, p) {
      checkTable(t, 1, 'remove');
      var size = len(t);
      var pos = p === undefined ? size : checkInt(p, 2, 'remove');
      if (p !== undefined && pos !== size && (pos < 1 || pos > size + 1)) throw argError(2, 'remove', 'position out of bounds');
      var result = index(t, pos);
      if (t.mt === null && size === t.arr.length && pos >= 1 && pos <= size) {
        t.arr.splice(pos - 1, 1);
        while (t.arr.length && t.arr[t.arr.length - 1] === undefined) t.arr.pop();
        return result;
      }
      for (; pos < size; pos++) setindex(t, pos, index(t, pos + 1));
      setindex(t, pos, undefined);
      return result;
    });
    T.set('concat', function (t, sep, i, j) {
      checkTable(t, 1, 'concat');
      sep = sep === undefined ? '' : checkStr(sep, 2, 'concat');
      var a = optInt(i, 3, 'concat', 1), b = j === undefined ? len(t) : checkInt(j, 4, 'concat');
      var parts = [];
      for (var k = a; k <= b; k++) {
        var v = index(t, k);
        if (typeof v === 'string') parts.push(v);
        else if (isNum(v)) parts.push(numStr(v));
        else throw rterror("invalid value (at index " + k + ") in table for 'concat'");
      }
      return parts.join(sep);
    });
    T.set('unpack', function (t, i, j) {
      var a = optInt(i, 2, 'unpack', 1), b = j === undefined ? len(t) : checkInt(j, 3, 'unpack');
      var out = [];
      for (var k = a; k <= b; k++) out.push(index(t, k));
      return ret(out);
    });
    T.set('pack', function () {
      var t = tbl(Array.prototype.slice.call(arguments));
      t.set('n', arguments.length);
      return t;
    });
    T.set('move', function (a1, f, e, t, a2) {
      if (a2 === undefined) a2 = a1;
      f = checkInt(f, 2, 'move'); e = checkInt(e, 3, 'move'); t = checkInt(t, 4, 'move');
      if (e >= f) {
        if (t > e || t <= f || a1 !== a2) for (var i = 0; i <= e - f; i++) setindex(a2, t + i, index(a1, f + i));
        else for (var k = e - f; k >= 0; k--) setindex(a2, t + k, index(a1, f + k));
      }
      return a2;
    });
    T.set('sort', function (t, comp) {
      checkTable(t, 1, 'sort');
      var n = len(t);
      if (n > 1) {
        var a = new Array(n + 1);
        for (var i = 1; i <= n; i++) a[i] = index(t, i);
        var less;
        if (comp !== undefined) {
          var cf = call(comp);
          less = function (x, y) { return truthy(first(cf(x, y))); };
        } else less = lt;
        auxsort(a, 1, n, 0, less);
        for (var j = 1; j <= n; j++) setindex(t, j, a[j]);
      }
      return NONE;
    });
    return T;
  }

  // Lua 5.4's ltablib.c sort, line for line: ties come out in the same
  // order as in the real Lua, which matters to engines that sort with them.
  var RANLIMIT = 100;
  function auxsort(a, lo, up, rnd, less) {
    var t;
    while (lo < up) {
      if (less(a[up], a[lo])) { t = a[lo]; a[lo] = a[up]; a[up] = t; }
      if (up - lo === 1) break;
      var p;
      if (up - lo < RANLIMIT || rnd === 0) p = Math.floor((lo + up) / 2);
      else { var r4 = Math.floor((up - lo) / 4); p = rnd % (r4 * 2) + (lo + r4); }
      if (less(a[p], a[lo])) { t = a[p]; a[p] = a[lo]; a[lo] = t; }
      else if (less(a[up], a[p])) { t = a[p]; a[p] = a[up]; a[up] = t; }
      if (up - lo === 2) break;
      var P = a[p];
      t = a[p]; a[p] = a[up - 1]; a[up - 1] = t;
      // partition
      var i = lo, j = up - 1;
      for (;;) {
        while (less(a[++i], P)) {
          if (i === up - 1) throw rterror('invalid order function for sorting');
        }
        while (less(P, a[--j])) {
          if (j < i) throw rterror('invalid order function for sorting');
        }
        if (j < i) { t = a[up - 1]; a[up - 1] = a[i]; a[i] = t; break; }
        t = a[i]; a[i] = a[j]; a[j] = t;
      }
      p = i;
      var n;
      if (p - lo < up - p) { auxsort(a, lo, p - 1, rnd, less); n = p - lo; lo = p + 1; }
      else { auxsort(a, p + 1, up, rnd, less); n = up - p; up = p - 1; }
      if ((up - lo) / 128 > n) rnd = 0x5bd1e995;   // real Lua randomises here
    }
  }

  // ---------------------------------------------------------- math ------
  function makeMathLib() {
    var M = new LuaTable();
    M.set('pi', Math.PI);
    M.set('huge', Infinity);
    M.set('maxinteger', 9223372036854775807);
    M.set('mininteger', -9223372036854775808);
    M.set('abs', function (x) {
      if (typeof x === 'number') return Number.isInteger(x) ? (x < 0 ? 0 - x : x) : Math.abs(x);
      if (x instanceof LFloat) return new LFloat(Math.abs(x.n));
      return mkfOrInt(Math.abs(checkNum(x, 1, 'abs')), x);
    });
    M.set('floor', function (x) {
      if (typeof x === 'number' && Number.isInteger(x)) return x;
      var r = Math.floor(checkNum(x, 1, 'floor'));
      return r === 0 ? 0 : r;
    });
    M.set('ceil', function (x) {
      if (typeof x === 'number' && Number.isInteger(x)) return x;
      var r = Math.ceil(checkNum(x, 1, 'ceil'));
      return r === 0 ? 0 : r;
    });
    function minmax(isMax, name) {
      return function () {
        if (arguments.length === 0) throw argError(1, name, 'number expected, got no value');
        var best = arguments[0]; checkNum(best, 1, name);
        for (var i = 1; i < arguments.length; i++) {
          var v = arguments[i]; checkNum(v, i + 1, name);
          if (isMax ? lt(best, v) : lt(v, best)) best = v;
        }
        return best;
      };
    }
    M.set('max', minmax(true, 'max'));
    M.set('min', minmax(false, 'min'));
    function fl(f, name) { return function (x) { return mkf(f(checkNum(x, 1, name))); }; }
    M.set('sqrt', fl(Math.sqrt, 'sqrt'));
    M.set('sin', fl(Math.sin, 'sin'));
    M.set('cos', fl(Math.cos, 'cos'));
    M.set('tan', fl(Math.tan, 'tan'));
    M.set('asin', fl(Math.asin, 'asin'));
    M.set('acos', fl(Math.acos, 'acos'));
    M.set('exp', fl(Math.exp, 'exp'));
    M.set('atan', function (y, x) { return mkf(Math.atan2(checkNum(y, 1, 'atan'), x === undefined ? 1 : checkNum(x, 2, 'atan'))); });
    M.set('log', function (x, base) {
      var v = checkNum(x, 1, 'log');
      if (base === undefined) return mkf(Math.log(v));
      var b = checkNum(base, 2, 'log');
      if (b === 2) return mkf(Math.log2(v));
      if (b === 10) return mkf(Math.log10(v));
      return mkf(Math.log(v) / Math.log(b));
    });
    M.set('fmod', function (a, b) {
      if (typeof a === 'number' && typeof b === 'number' && Number.isInteger(a) && Number.isInteger(b)) {
        if (b === 0) throw argError(2, 'fmod', 'zero');
        return a % b === 0 ? 0 : a % b;
      }
      return mkf(checkNum(a, 1, 'fmod') % checkNum(b, 2, 'fmod'));
    });
    M.set('modf', function (x) {
      var v = checkNum(x, 1, 'modf');
      var ip = v >= 0 ? Math.floor(v) : Math.ceil(v);
      var fp = (v === Infinity || v === -Infinity) ? 0 : v - ip;
      return new Multi([mkf(ip), mkf(fp)]);
    });
    M.set('tointeger', function (x) {
      if (typeof x === 'number' && Number.isInteger(x)) return x;
      if (x instanceof LFloat) return x.n;
      if (typeof x === 'string') { var n = str2num(x); return n === undefined ? undefined : (typeof n === 'number' && Number.isInteger(n) ? n : (n instanceof LFloat ? n.n : undefined)); }
      return undefined;
    });
    M.set('type', function (x) {
      if (arguments.length === 0) throw argError(1, 'type', 'value expected');
      if (typeof x === 'number') return Number.isInteger(x) ? 'integer' : 'float';
      if (x instanceof LFloat) return 'float';
      return undefined;
    });
    M.set('ult', function (a, b) {
      return BigInt.asUintN(64, BigInt(checkInt(a, 1, 'ult'))) < BigInt.asUintN(64, BigInt(checkInt(b, 2, 'ult')));
    });

    // xoshiro256**, as lmathlib.c has it, on 64-bit BigInts.
    var MASK = (1n << 64n) - 1n;
    var state = [0n, 0n, 0n, 0n];
    function rotl(x, n) { return ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK; }
    function nextrand() {
      var s0 = state[0], s1 = state[1], s2 = state[2] ^ s0, s3 = state[3] ^ s1;
      var res = (rotl((s1 * 5n) & MASK, 7) * 9n) & MASK;
      state[0] = s0 ^ s3;
      state[1] = s1 ^ s2;
      state[2] = s2 ^ ((s1 << 17n) & MASK);
      state[3] = rotl(s3, 45);
      return res;
    }
    function setseed(n1, n2) {
      state = [BigInt.asUintN(64, n1), 0xffn, BigInt.asUintN(64, n2), 0n];
      for (var i = 0; i < 16; i++) nextrand();
    }
    setseed(BigInt(Date.now()), 0n);
    function project(ran, n) {
      if ((n & (n + 1n)) === 0n) return ran & n;
      var lim = n;
      lim |= lim >> 1n; lim |= lim >> 2n; lim |= lim >> 4n; lim |= lim >> 8n;
      lim |= lim >> 16n; lim |= lim >> 32n;
      while ((ran &= lim) > n) ran = nextrand();
      return ran;
    }
    M.set('random', function (m, n) {
      var rv = nextrand();
      var low, up;
      switch (arguments.length) {
        case 0: return mkf(Number(rv >> 11n) * Math.pow(2, -53));
        case 1:
          low = 1n; up = BigInt(checkInt(m, 1, 'random'));
          if (up === 0n) return fromInt64(rv);
          break;
        case 2:
          low = BigInt(checkInt(m, 1, 'random')); up = BigInt(checkInt(n, 2, 'random'));
          break;
        default: throw rterror('wrong number of arguments');
      }
      if (!(low <= up)) throw argError(1, 'random', 'interval is empty');
      var p = project(rv, BigInt.asUintN(64, up - low));
      return fromInt64(p + BigInt.asUintN(64, low));
    });
    M.set('randomseed', function (a, b) {
      if (arguments.length === 0) { setseed(BigInt(Date.now()), 0n); return; }
      var n1 = isFloatVal(a) ? BigInt(Math.trunc(num(a))) : BigInt(checkInt(a, 1, 'randomseed'));
      var n2 = b === undefined ? 0n : BigInt(checkInt(b, 2, 'randomseed'));
      setseed(n1, n2);
      return new Multi([fromInt64(n1), fromInt64(n2)]);
    });
    return M;
  }
  function mkfOrInt(r, orig) { return isFloatVal(orig) ? mkf(r) : r; }

  // ------------------------------------------------------------ os ------
  function makeOsLib(host) {
    var O = new LuaTable();
    var now = host.now || function () { return Date.now(); };
    O.set('time', function (t) {
      if (t === undefined) return Math.floor(now() / 1000);
      checkTable(t, 1, 'time');
      function field(k, d) {
        var v = t.get(k);
        if (v === undefined) { if (d === undefined) throw rterror("field '" + k + "' missing in date table"); return d; }
        return num(v);
      }
      var d = new Date(field('year'), field('month') - 1, field('day'), field('hour', 12), field('min', 0), field('sec', 0));
      return Math.floor(d.getTime() / 1000);
    });
    O.set('clock', function () {
      var p = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      return mkf(p / 1000);
    });
    O.set('date', function (fmt, t) {
      fmt = fmt === undefined ? '%c' : checkStr(fmt, 1, 'date');
      var ms = t === undefined ? now() : num(t) * 1000;
      var utc = fmt[0] === '!';
      if (utc) fmt = fmt.slice(1);
      var d = new Date(ms);
      var g = utc
        ? { Y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), H: d.getUTCHours(), M: d.getUTCMinutes(), S: d.getUTCSeconds(), w: d.getUTCDay() }
        : { Y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), H: d.getHours(), M: d.getMinutes(), S: d.getSeconds(), w: d.getDay() };
      var start = utc ? Date.UTC(g.Y, 0, 1) : new Date(g.Y, 0, 1).getTime();
      var cur = utc ? Date.UTC(g.Y, g.m, g.d) : new Date(g.Y, g.m, g.d).getTime();
      var yday = Math.round((cur - start) / 86400000) + 1;
      if (fmt.slice(0, 2) === '*t') {
        var r = new LuaTable();
        r.set('year', g.Y); r.set('month', g.m + 1); r.set('day', g.d);
        r.set('hour', g.H); r.set('min', g.M); r.set('sec', g.S);
        r.set('wday', g.w + 1); r.set('yday', yday); r.set('isdst', false);
        return r;
      }
      var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      function p2(n) { return (n < 10 ? '0' : '') + n; }
      return fmt.replace(/%(.)/g, function (_, c) {
        switch (c) {
          case 'Y': return String(g.Y);
          case 'y': return p2(g.Y % 100);
          case 'm': return p2(g.m + 1);
          case 'd': return p2(g.d);
          case 'e': return (g.d < 10 ? ' ' : '') + g.d;
          case 'H': return p2(g.H);
          case 'I': return p2(((g.H + 11) % 12) + 1);
          case 'M': return p2(g.M);
          case 'S': return p2(g.S);
          case 'p': return g.H < 12 ? 'AM' : 'PM';
          case 'A': return DAYS[g.w];
          case 'a': return DAYS[g.w].slice(0, 3);
          case 'B': return MONTHS[g.m];
          case 'b': return MONTHS[g.m].slice(0, 3);
          case 'j': return String(yday).padStart(3, '0');
          case 'w': return String(g.w);
          case 'u': return String(g.w === 0 ? 7 : g.w);
          case 'x': return p2(g.m + 1) + '/' + p2(g.d) + '/' + p2(g.Y % 100);
          case 'X': return p2(g.H) + ':' + p2(g.M) + ':' + p2(g.S);
          case 'c': return DAYS[g.w].slice(0, 3) + ' ' + MONTHS[g.m].slice(0, 3) + ' ' + (g.d < 10 ? ' ' : '') + g.d + ' ' + p2(g.H) + ':' + p2(g.M) + ':' + p2(g.S) + ' ' + g.Y;
          case '%': return '%';
          default: return '%' + c;
        }
      });
    });
    O.set('getenv', function () { return undefined; });
    O.set('remove', function (path) {
      if (host.removeFile && host.removeFile(path)) return true;
      return new Multi([undefined, path + ': No such file or directory', 2]);
    });
    O.set('rename', function (a, b) {
      if (host.renameFile && host.renameFile(a, b)) return true;
      return new Multi([undefined, a + ': No such file or directory', 2]);
    });
    O.set('exit', function () { throw new LuaError('os.exit called'); });
    O.set('tmpname', function () { return '/tmp/lua_' + Math.random().toString(36).slice(2); });
    return O;
  }

  // ------------------------------------------------------------ io ------
  // Files live wherever the host keeps them (host.readFile / host.writeFile):
  // Battle Pass keeps its save file this way.
  function makeIoLib(host) {
    var IO = new LuaTable();
    var fileMeta = new LuaTable();
    var fileMethods = new LuaTable();
    fileMeta.set('__index', fileMethods);
    fileMeta.set('__name', 'FILE*');
    function newFile(path, mode, data) {
      var f = new LuaTable();
      f.mt = fileMeta;
      f._path = path; f._mode = mode; f._data = data; f._pos = 0; f._closed = false;
      return f;
    }
    IO.set('open', function (path, mode) {
      path = checkStr(path, 1, 'open');
      mode = mode === undefined ? 'r' : checkStr(mode, 2, 'open');
      var m = mode.replace('b', '');
      if (m[0] === 'r') {
        var data = host.readFile ? host.readFile(path) : null;
        if (data === null || data === undefined) return new Multi([undefined, path + ': No such file or directory', 2]);
        return newFile(path, m, data);
      }
      if (m[0] === 'w') return newFile(path, m, '');
      if (m[0] === 'a') {
        var old = host.readFile ? host.readFile(path) : null;
        var f = newFile(path, m, old || '');
        f._pos = f._data.length;
        return f;
      }
      throw argError(2, 'open', 'invalid mode');
    });
    fileMethods.set('read', function (f) {
      var fmts = Array.prototype.slice.call(arguments, 1);
      if (!fmts.length) fmts = ['l'];
      var out = [];
      for (var i = 0; i < fmts.length; i++) {
        var fm = fmts[i];
        if (isNum(fm)) {
          var n = num(fm);
          if (f._pos >= f._data.length && n > 0) { out.push(undefined); break; }
          out.push(f._data.substr(f._pos, n)); f._pos += n; continue;
        }
        fm = String(fm).replace(/^\*/, '');
        if (fm[0] === 'a') { out.push(f._data.slice(f._pos)); f._pos = f._data.length; continue; }
        if (fm[0] === 'l' || fm[0] === 'L') {
          if (f._pos >= f._data.length) { out.push(undefined); break; }
          var e = f._data.indexOf('\n', f._pos);
          var line = e < 0 ? f._data.slice(f._pos) : f._data.slice(f._pos, fm[0] === 'L' ? e + 1 : e);
          f._pos = e < 0 ? f._data.length : e + 1;
          out.push(line); continue;
        }
        if (fm[0] === 'n') {
          var m = /^\s*[-+]?(0[xX][0-9a-fA-F.]+|\d*\.?\d+(?:[eE][-+]?\d+)?)/.exec(f._data.slice(f._pos));
          if (!m) { out.push(undefined); break; }
          f._pos += m[0].length; out.push(str2num(m[0])); continue;
        }
      }
      return ret(out);
    });
    fileMethods.set('write', function (f) {
      for (var i = 1; i < arguments.length; i++) {
        var v = arguments[i];
        var s = typeof v === 'string' ? v : writeNum(v);
        f._data = f._data.slice(0, f._pos) + s + f._data.slice(f._pos + s.length);
        f._pos += s.length;
      }
      return f;
    });
    fileMethods.set('lines', function (f) {
      return function () { return first(fileMethods.get('read')(f, 'l')); };
    });
    fileMethods.set('seek', function (f, whence, off) {
      whence = whence || 'cur'; off = off === undefined ? 0 : num(off);
      if (whence === 'set') f._pos = off;
      else if (whence === 'end') f._pos = f._data.length + off;
      else f._pos += off;
      return f._pos;
    });
    fileMethods.set('flush', function (f) {
      if (f._mode[0] !== 'r' && host.writeFile) host.writeFile(f._path, f._data);
      return f;
    });
    fileMethods.set('close', function (f) {
      if (!f._closed && f._mode[0] !== 'r' && host.writeFile) host.writeFile(f._path, f._data);
      f._closed = true;
      return true;
    });
    fileMethods.set('setvbuf', function () { return true; });
    IO.set('write', function () {
      var s = '';
      for (var i = 0; i < arguments.length; i++) s += typeof arguments[i] === 'string' ? arguments[i] : writeNum(arguments[i]);
      (host.write || host.print || function (x) { if (typeof process !== 'undefined') process.stdout.write(x); })(s);
      return NONE;
    });
    IO.set('lines', function (path) {
      var data = host.readFile ? host.readFile(path) : null;
      if (data === null || data === undefined) throw rterror(path + ': No such file or directory');
      var f = newFile(path, 'r', data);
      return function () { return first(fileMethods.get('read')(f, 'l')); };
    });
    return IO;
  }

  // ---------------------------------------------------------- utf8 ------
  function makeUtf8Lib() {
    var U = new LuaTable();
    U.set('char', function () {
      var s = '';
      for (var i = 0; i < arguments.length; i++) s += NS.utf8Bytes(checkInt(arguments[i], i + 1, 'char'));
      return s;
    });
    U.set('charpattern', '[\x00-\x7F\xC2-\xFD][\x80-\xBF]*');
    function decodeAt(s, i) {   // i 0-based; returns [codepoint, length] or null
      var c = s.charCodeAt(i);
      if (c < 0x80) return [c, 1];
      var n = c >= 0xF0 ? 4 : c >= 0xE0 ? 3 : c >= 0xC0 ? 2 : 0;
      if (!n) return null;
      var cp = c & (0x7F >> n);
      for (var k = 1; k < n; k++) {
        var cc = s.charCodeAt(i + k);
        if ((cc & 0xC0) !== 0x80) return null;
        cp = (cp << 6) | (cc & 0x3F);
      }
      return [cp, n];
    }
    U.set('len', function (s, i, j) {
      s = checkStr(s, 1, 'len');
      var a = (i === undefined ? 1 : num(i)) - 1, b = j === undefined ? s.length : num(j);
      var n = 0;
      while (a < b) {
        var d = decodeAt(s, a);
        if (!d) return new Multi([undefined, a + 1]);
        a += d[1]; n++;
      }
      return n;
    });
    U.set('codepoint', function (s, i, j) {
      s = checkStr(s, 1, 'codepoint');
      var a = (i === undefined ? 1 : num(i)), b = j === undefined ? a : num(j);
      var out = [], p = a - 1;
      while (p < b) {
        var d = decodeAt(s, p);
        if (!d) throw rterror('invalid UTF-8 code');
        out.push(d[0]); p += d[1];
      }
      return ret(out);
    });
    U.set('offset', function (s, n, i) {
      s = checkStr(s, 1, 'offset');
      n = num(n);
      var p = i === undefined ? (n >= 0 ? 1 : s.length + 1) : num(i);
      p -= 1;
      function cont(k) { return (s.charCodeAt(k) & 0xC0) === 0x80; }
      if (n === 0) { while (p > 0 && cont(p)) p--; return p + 1; }
      if (n > 0) { n--; while (n > 0 && p < s.length) { p++; while (cont(p)) p++; n--; } return n === 0 ? p + 1 : undefined; }
      while (n < 0 && p > 0) { p--; while (p > 0 && cont(p)) p--; n++; }
      return n === 0 ? p + 1 : undefined;
    });
    U.set('codes', function (s) {
      s = checkStr(s, 1, 'codes');
      return new Multi([function (str, i) {
        var p = num(i);
        if (p > 0) { var d0 = decodeAt(str, p - 1); p += d0 ? d0[1] - 1 : 0; }
        if (p >= str.length) return undefined;
        var d = decodeAt(str, p);
        if (!d) throw rterror('invalid UTF-8 code');
        return new Multi([p + 1, d[0]]);
      }, s, 0]);
    });
    return U;
  }

  // ======================================================== strings =======
  var stringLib = new LuaTable();
  var stringMeta = new LuaTable();
  stringMeta.set('__index', stringLib);

  function posrelatI(pos, l) {
    if (pos > 0) return pos;
    if (pos === 0) return 1;
    if (pos < -l) return 1;
    return l + pos + 1;
  }
  function getendpos(pos, l) {
    if (pos > l) return l;
    if (pos >= 0) return pos;
    if (pos < -l) return 0;
    return l + pos + 1;
  }
  stringLib.set('len', function (s) { return checkStr(s, 1, 'len').length; });
  stringLib.set('sub', function (s, i, j) {
    s = checkStr(s, 1, 'sub');
    var l = s.length;
    var st = posrelatI(checkInt(i === undefined ? 1 : i, 2, 'sub'), l);
    var en = getendpos(j === undefined ? -1 : checkInt(j, 3, 'sub'), l);
    if (st < 1) st = 1;
    if (en > l) en = l;
    return st <= en ? s.slice(st - 1, en) : '';
  });
  stringLib.set('upper', function (s) {
    s = checkStr(s, 1, 'upper');
    return s.replace(/[a-z]+/g, function (m) { return m.toUpperCase(); });
  });
  stringLib.set('lower', function (s) {
    s = checkStr(s, 1, 'lower');
    return s.replace(/[A-Z]+/g, function (m) { return m.toLowerCase(); });
  });
  stringLib.set('rep', function (s, n, sep) {
    s = checkStr(s, 1, 'rep'); n = checkInt(n, 2, 'rep');
    if (n <= 0) return '';
    if (sep === undefined || sep === '') return s.repeat(n);
    sep = checkStr(sep, 3, 'rep');
    return Array(n).fill(s).join(sep);
  });
  stringLib.set('reverse', function (s) { return checkStr(s, 1, 'reverse').split('').reverse().join(''); });
  stringLib.set('byte', function (s, i, j) {
    s = checkStr(s, 1, 'byte');
    var l = s.length;
    var pi = posrelatI(optInt(i, 2, 'byte', 1), l);
    var pe = getendpos(j === undefined ? pi : checkInt(j, 3, 'byte'), l);
    if (pi > pe) return undefined;
    var out = [];
    for (var k = pi; k <= pe; k++) out.push(s.charCodeAt(k - 1));
    return ret(out);
  });
  stringLib.set('char', function () {
    var out = '';
    for (var i = 0; i < arguments.length; i++) {
      var c = checkInt(arguments[i], i + 1, 'char');
      if (c < 0 || c > 255) throw argError(i + 1, 'char', 'value out of range');
      out += String.fromCharCode(c);
    }
    return out;
  });

  // string.format, with C's own rounding.
  stringLib.set('format', function (fmt) {
    fmt = checkStr(fmt, 1, 'format');
    var args = arguments, argi = 1;
    var out = '', i = 0, n = fmt.length;
    while (i < n) {
      var c = fmt[i++];
      if (c !== '%') { out += c; continue; }
      if (fmt[i] === '%') { out += '%'; i++; continue; }
      var m = /^([-+ #0]*)(\d*)(?:\.(\d*))?([a-zA-Z])/.exec(fmt.slice(i));
      if (!m) throw rterror("invalid conversion '%" + fmt.slice(i, i + 5) + "' to 'format'");
      i += m[0].length;
      var flags = m[1], width = m[2] ? Number(m[2]) : 0, prec = m[3] === undefined ? undefined : Number(m[3] || 0);
      var conv = m[4];
      var argn = ++argi;
      if (argn > args.length - 1 + 1 && conv !== '%') {
        if (args[argn - 1] === undefined && argn > args.length) throw argError(argn, 'format', 'no value');
      }
      var v = args[argn - 1], body, sign = '';
      switch (conv) {
        case 'd': case 'i': {
          var iv = checkInt(v, argn, 'format');
          body = String(Math.abs(iv) < 1e21 ? Math.abs(iv) : BigInt(iv) * (iv < 0 ? -1n : 1n));
          if (prec !== undefined) { body = body.padStart(prec, '0'); if (prec === 0 && iv === 0) body = ''; }
          sign = iv < 0 ? '-' : (flags.indexOf('+') >= 0 ? '+' : (flags.indexOf(' ') >= 0 ? ' ' : ''));
          out += pad(sign, body, width, flags, prec === undefined);
          break;
        }
        case 'u': {
          var uv = checkInt(v, argn, 'format');
          body = BigInt.asUintN(64, BigInt(uv)).toString();
          out += pad('', body, width, flags, true);
          break;
        }
        case 'c': out += pad('', String.fromCharCode(checkInt(v, argn, 'format')), width, flags.replace('0', ''), false); break;
        case 'x': case 'X': case 'o': {
          var xv = BigInt.asUintN(64, BigInt(checkInt(v, argn, 'format')));
          body = xv.toString(conv === 'o' ? 8 : 16);
          if (conv === 'X') body = body.toUpperCase();
          if (prec !== undefined) body = body.padStart(prec, '0');
          var pre = (flags.indexOf('#') >= 0 && xv !== 0n) ? (conv === 'o' ? '0' : (conv === 'x' ? '0x' : '0X')) : '';
          out += pad(pre, body, width, flags, prec === undefined);
          break;
        }
        case 'e': case 'E': case 'f': case 'F': case 'g': case 'G': case 'a': case 'A': {
          var fv = checkNum(v, argn, 'format');
          var neg = fv < 0 || (fv === 0 && 1 / fv < 0);
          var ax = Math.abs(fv);
          var up = conv === 'E' || conv === 'G' || conv === 'F' || conv === 'A';
          if (ax === Infinity || fv !== fv) {
            body = fv !== fv ? 'nan' : 'inf';
            if (up) body = body.toUpperCase();
            sign = neg && fv === fv ? '-' : (flags.indexOf('+') >= 0 ? '+' : (flags.indexOf(' ') >= 0 ? ' ' : ''));
            out += pad(sign, body, width, flags.replace('0', ''), false);
            break;
          }
          var p = prec === undefined ? 6 : prec;
          var alt = flags.indexOf('#') >= 0;
          if (conv === 'f' || conv === 'F') { body = fixedDigits(ax, p); if (alt && p === 0) body += '.'; }
          else if (conv === 'e' || conv === 'E') body = fmtExp(ax, p, up);
          else if (conv === 'g' || conv === 'G') body = fmtG(ax, p, up, alt);
          else body = hexFloat(ax, prec, up);
          sign = neg ? '-' : (flags.indexOf('+') >= 0 ? '+' : (flags.indexOf(' ') >= 0 ? ' ' : ''));
          out += pad(sign, body, width, flags, true);
          break;
        }
        case 's': {
          var sv = tostring(v);
          if (args.length < argn) throw argError(argn, 'format', 'no value');
          if (prec !== undefined) sv = sv.slice(0, prec);
          out += pad('', sv, width, flags.replace('0', ''), false);
          break;
        }
        case 'q': out += quoteString(v); break;
        default:
          throw rterror("invalid conversion '%" + m[0] + "' to 'format'");
      }
    }
    return out;
  });
  function pad(sign, body, width, flags, zeroOk) {
    var total = sign.length + body.length;
    if (total >= width) return sign + body;
    if (flags.indexOf('-') >= 0) return sign + body + ' '.repeat(width - total);
    if (zeroOk && flags.indexOf('0') >= 0) return sign + '0'.repeat(width - total) + body;
    return ' '.repeat(width - total) + sign + body;
  }
  function hexFloat(x, prec, up) {
    if (x === 0) return up ? '0X0P+0' : '0x0p+0';
    var e = Math.floor(Math.log2(x)), m = x / Math.pow(2, e);
    if (m >= 2) { m /= 2; e++; } else if (m < 1) { m *= 2; e--; }
    var frac = (m - 1).toString(16).slice(2);
    if (prec !== undefined) frac = frac.slice(0, prec).padEnd(prec, '0');
    var s = '0x1' + (frac ? '.' + frac : '') + 'p' + (e >= 0 ? '+' : '') + e;
    return up ? s.toUpperCase() : s;
  }
  function quoteString(v) {
    if (typeof v === 'string') {
      var o = '"';
      for (var i = 0; i < v.length; i++) {
        var c = v.charCodeAt(i), ch = v[i];
        if (ch === '"' || ch === '\\') o += '\\' + ch;
        else if (ch === '\n') o += '\\\n';
        else if (ch === '\r') o += '\\r';
        else if (c === 0) o += (i + 1 < v.length && /\d/.test(v[i + 1])) ? '\\000' : '\\0';
        else if (c < 32 || c === 127) o += '\\' + ((i + 1 < v.length && /\d/.test(v[i + 1])) ? String(c).padStart(3, '0') : c);
        else o += ch;
      }
      return o + '"';
    }
    if (typeof v === 'number' && Number.isInteger(v)) return intStr(v);
    if (isNum(v)) {
      var x = num(v);
      if (x === Infinity) return '1e9999';
      if (x === -Infinity) return '-1e9999';
      if (x !== x) return '(0/0)';
      if (x === Math.floor(x)) return (x < 0 ? '-' : '') + hexFloat(Math.abs(x)) ;
      return (x < 0 ? '-' : '') + hexFloat(Math.abs(x));
    }
    if (v === undefined || typeof v === 'boolean') return tostring(v);
    throw rterror("bad argument to 'format' (value has no literal form)");
  }

  // ----------------------------------------------------- patterns ------
  // lstrlib.c's matcher, ported line for line.
  var L_ESC = 37, CAP_UNFINISHED = -1, CAP_POSITION = -2, MAXCCALLS = 200, MAXCAPTURES = 32;
  function MatchState(src, pat) {
    this.src = src; this.pat = pat; this.level = 0; this.matchdepth = MAXCCALLS;
    this.capInit = new Array(MAXCAPTURES); this.capLen = new Array(MAXCAPTURES);
  }
  function classEnd(ms, p) {
    var pat = ms.pat, pe = pat.length;
    var c = pat.charCodeAt(p++);
    if (c === L_ESC) {
      if (p >= pe) throw rterror("malformed pattern (ends with '%')");
      return p + 1;
    }
    if (c === 91) {   // '['
      if (pat.charCodeAt(p) === 94) p++;
      do {
        if (p >= pe) throw rterror("malformed pattern (missing ']')");
        if (pat.charCodeAt(p++) === L_ESC && p < pe) p++;
      } while (pat.charCodeAt(p) !== 93);
      return p + 1;
    }
    return p;
  }
  function isalpha(c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122); }
  function isdigit(c) { return c >= 48 && c <= 57; }
  function islower(c) { return c >= 97 && c <= 122; }
  function isupper(c) { return c >= 65 && c <= 90; }
  function isspace(c) { return c === 32 || (c >= 9 && c <= 13); }
  function iscntrl(c) { return c < 32 || c === 127; }
  function ispunct(c) { return c >= 33 && c <= 126 && !isalpha(c) && !isdigit(c); }
  function isxdigit(c) { return isdigit(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70); }
  function matchClass(c, cl) {
    var res;
    var low = cl >= 65 && cl <= 90 ? cl + 32 : cl;
    switch (low) {
      case 97: res = isalpha(c); break;            // a
      case 99: res = iscntrl(c); break;            // c
      case 100: res = isdigit(c); break;           // d
      case 103: res = c >= 33 && c <= 126; break;  // g
      case 108: res = islower(c); break;           // l
      case 112: res = ispunct(c); break;           // p
      case 115: res = isspace(c); break;           // s
      case 117: res = isupper(c); break;           // u
      case 119: res = isalpha(c) || isdigit(c); break; // w
      case 120: res = isxdigit(c); break;          // x
      default: return cl === c;
    }
    if (isupper(cl)) res = !res;
    return res;
  }
  function matchBracketClass(ms, c, p, ec) {
    var pat = ms.pat, sig = true;
    if (pat.charCodeAt(p + 1) === 94) { sig = false; p++; }
    while (++p < ec) {
      var pc = pat.charCodeAt(p);
      if (pc === L_ESC) {
        p++;
        if (matchClass(c, pat.charCodeAt(p))) return sig;
      } else if (pat.charCodeAt(p + 1) === 45 && p + 2 < ec) {
        p += 2;
        if (pat.charCodeAt(p - 2) <= c && c <= pat.charCodeAt(p)) return sig;
      } else if (pc === c) return sig;
    }
    return !sig;
  }
  function singleMatch(ms, s, p, ep) {
    if (s >= ms.src.length) return false;
    var c = ms.src.charCodeAt(s);
    var pc = ms.pat.charCodeAt(p);
    switch (pc) {
      case 46: return true;                                  // '.'
      case L_ESC: return matchClass(c, ms.pat.charCodeAt(p + 1));
      case 91: return matchBracketClass(ms, c, p, ep - 1);
      default: return pc === c;
    }
  }
  function matchBalance(ms, s, p) {
    if (p >= ms.pat.length - 1) throw rterror("malformed pattern (missing arguments to '%b')");
    var src = ms.src;
    if (src.charCodeAt(s) !== ms.pat.charCodeAt(p)) return -1;
    var b = ms.pat.charCodeAt(p), e = ms.pat.charCodeAt(p + 1), cont = 1;
    while (++s < src.length) {
      var c = src.charCodeAt(s);
      if (c === e) { if (--cont === 0) return s + 1; }
      else if (c === b) cont++;
    }
    return -1;
  }
  function maxExpand(ms, s, p, ep) {
    var i = 0;
    while (singleMatch(ms, s + i, p, ep)) i++;
    while (i >= 0) {
      var res = doMatch(ms, s + i, ep + 1);
      if (res !== -1) return res;
      i--;
    }
    return -1;
  }
  function minExpand(ms, s, p, ep) {
    for (;;) {
      var res = doMatch(ms, s, ep + 1);
      if (res !== -1) return res;
      else if (singleMatch(ms, s, p, ep)) s++;
      else return -1;
    }
  }
  function startCapture(ms, s, p, what) {
    var level = ms.level;
    if (level >= MAXCAPTURES) throw rterror('too many captures');
    ms.capInit[level] = s; ms.capLen[level] = what;
    ms.level = level + 1;
    var res = doMatch(ms, s, p);
    if (res === -1) ms.level--;
    return res;
  }
  function captureToClose(ms) {
    var level = ms.level;
    for (level--; level >= 0; level--) if (ms.capLen[level] === CAP_UNFINISHED) return level;
    throw rterror('invalid pattern capture');
  }
  function endCapture(ms, s, p) {
    var l = captureToClose(ms);
    ms.capLen[l] = s - ms.capInit[l];
    var res = doMatch(ms, s, p);
    if (res === -1) ms.capLen[l] = CAP_UNFINISHED;
    return res;
  }
  function checkCapture(ms, l) {
    l -= 49;
    if (l < 0 || l >= ms.level || ms.capLen[l] === CAP_UNFINISHED) throw rterror('invalid capture index %' + (l + 1));
    return l;
  }
  function matchCapture(ms, s, l) {
    l = checkCapture(ms, l);
    var len = ms.capLen[l];
    var cap = ms.src.substr(ms.capInit[l], len);
    if (ms.src.length - s >= len && ms.src.substr(s, len) === cap) return s + len;
    return -1;
  }
  function doMatch(ms, s, p) {
    if (ms.matchdepth-- === 0) throw rterror('pattern too complex');
    var pat = ms.pat, pe = pat.length;
    for (;;) {
      if (p === pe) break;
      var pc = pat.charCodeAt(p);
      if (pc === 40) {                                     // '('
        if (pat.charCodeAt(p + 1) === 41) s = startCapture(ms, s, p + 2, CAP_POSITION);
        else s = startCapture(ms, s, p + 1, CAP_UNFINISHED);
        break;
      }
      if (pc === 41) { s = endCapture(ms, s, p + 1); break; }   // ')'
      if (pc === 36 && p + 1 === pe) {                     // '$' at the end
        s = (s === ms.src.length) ? s : -1;
        break;
      }
      if (pc === L_ESC) {
        var nx = pat.charCodeAt(p + 1);
        if (nx === 98) {                                   // %b
          s = matchBalance(ms, s, p + 2);
          if (s !== -1) { p += 4; continue; }
          break;
        }
        if (nx === 102) {                                  // %f
          p += 2;
          if (pat.charCodeAt(p) !== 91) throw rterror("missing '[' after '%f' in pattern");
          var ep0 = classEnd(ms, p);
          var prev = (s === 0) ? 0 : ms.src.charCodeAt(s - 1);
          var cur = s < ms.src.length ? ms.src.charCodeAt(s) : 0;
          if (!matchBracketClass(ms, prev, p, ep0 - 1) && matchBracketClass(ms, cur, p, ep0 - 1)) { p = ep0; continue; }
          s = -1; break;
        }
        if (nx >= 48 && nx <= 57) {                        // %0-%9
          s = matchCapture(ms, s, nx);
          if (s !== -1) { p += 2; continue; }
          break;
        }
      }
      // default: a single class with an optional suffix
      var ep = classEnd(ms, p);
      var epc = pat.charCodeAt(ep);
      if (!singleMatch(ms, s, p, ep)) {
        if (epc === 42 || epc === 63 || epc === 45) { p = ep + 1; continue; }   // * ? -
        s = -1; break;
      }
      if (epc === 63) {                                    // ?
        var res = doMatch(ms, s + 1, ep + 1);
        if (res !== -1) { s = res; break; }
        p = ep + 1; continue;
      }
      if (epc === 43) { s = maxExpand(ms, s + 1, p, ep); break; }   // +
      if (epc === 42) { s = maxExpand(ms, s, p, ep); break; }       // *
      if (epc === 45) { s = minExpand(ms, s, p, ep); break; }       // -
      s++; p = ep;
    }
    ms.matchdepth++;
    return s;
  }
  function getCapture(ms, i, s, e) {
    if (i >= ms.level) {
      if (i !== 0) throw rterror('invalid capture index %' + (i + 1));
      return ms.src.slice(s, e);
    }
    var l = ms.capLen[i];
    if (l === CAP_UNFINISHED) throw rterror('unfinished capture');
    if (l === CAP_POSITION) return ms.capInit[i] + 1;
    return ms.src.substr(ms.capInit[i], l);
  }
  function captures(ms, s, e, wholeIfNone) {
    var n = (ms.level === 0 && wholeIfNone) ? 1 : ms.level;
    var out = [];
    for (var i = 0; i < n; i++) out.push(getCapture(ms, i, s, e));
    return out;
  }
  var SPECIALS = /[\^$*+?.()[\]%-]/;
  function strFindAux(find, s, p, init, plain, fname) {
    s = checkStr(s, 1, fname); p = checkStr(p, 2, fname);
    var ls = s.length;
    var st = posrelatI(optInt(init, 3, fname, 1), ls) - 1;
    if (st > ls) return undefined;
    if (find && (truthy(plain) || !SPECIALS.test(p))) {
      var idx = s.indexOf(p, st);
      if (idx >= 0) return new Multi([idx + 1, idx + p.length]);
      return undefined;
    }
    var anchor = p.charCodeAt(0) === 94;
    var pp = anchor ? p.slice(1) : p;
    var ms = new MatchState(s, pp);
    var s1 = st;
    do {
      ms.level = 0; ms.matchdepth = MAXCCALLS;
      var res = doMatch(ms, s1, 0);
      if (res !== -1) {
        if (find) return new Multi([s1 + 1, res].concat(captures(ms, -1, 0, false)));
        return ret(captures(ms, s1, res, true));
      }
    } while (s1++ < ls && !anchor);
    return undefined;
  }
  stringLib.set('find', function (s, p, init, plain) { return strFindAux(true, s, p, init, plain, 'find'); });
  stringLib.set('match', function (s, p, init) { return strFindAux(false, s, p, init, false, 'match'); });
  stringLib.set('gmatch', function (s, p, init) {
    s = checkStr(s, 1, 'gmatch'); p = checkStr(p, 2, 'gmatch');
    var ls = s.length;
    var src = posrelatI(optInt(init, 3, 'gmatch', 1), ls) - 1;
    if (src > ls) src = ls + 1;
    var ms = new MatchState(s, p), lastmatch = -1;
    return function () {
      for (; src <= ls; src++) {
        ms.level = 0; ms.matchdepth = MAXCCALLS;
        var e = doMatch(ms, src, 0);
        if (e !== -1 && e !== lastmatch) {
          var start = src;
          src = lastmatch = e;
          return ret(captures(ms, start, e, true));
        }
      }
      return undefined;
    };
  });
  stringLib.set('gsub', function (s, p, repl, maxn) {
    s = checkStr(s, 1, 'gsub'); p = checkStr(p, 2, 'gsub');
    var tr = typeName(repl);
    if (!(tr === 'number' || tr === 'string' || tr === 'table' || tr === 'function')) {
      throw argError(3, 'gsub', 'string/function/table expected, got ' + typeNameArg(repl));
    }
    var maxS = maxn === undefined ? s.length + 1 : checkInt(maxn, 4, 'gsub');
    var anchor = p.charCodeAt(0) === 94;
    var pp = anchor ? p.slice(1) : p;
    var ms = new MatchState(s, pp);
    var src = 0, lastmatch = -1, n = 0, out = '';
    var rs = tr === 'string' || tr === 'number' ? (typeof repl === 'string' ? repl : numStr(repl)) : null;
    while (n < maxS) {
      ms.level = 0; ms.matchdepth = MAXCCALLS;
      var e = doMatch(ms, src, 0);
      if (e !== -1 && e !== lastmatch) {
        n++;
        out += addValue(ms, src, e, repl, rs, tr);
        src = lastmatch = e;
      } else if (src < s.length) out += s[src++];
      else break;
      if (anchor) break;
    }
    if (src < s.length) out += s.slice(src);
    return new Multi([out, n]);
  });
  function addValue(ms, s, e, repl, rs, tr) {
    var whole = ms.src.slice(s, e), v;
    if (rs !== null) {
      var o = '';
      for (var i = 0; i < rs.length; i++) {
        var c = rs[i];
        if (c !== '%') { o += c; continue; }
        i++;
        var d = rs[i];
        if (d === '%') o += '%';
        else if (d !== undefined && d >= '0' && d <= '9') {
          var cap = d === '0' ? whole : getCapture(ms, d.charCodeAt(0) - 49, s, e);
          o += typeof cap === 'string' ? cap : numStr(cap);
        } else throw rterror("invalid use of '%' in replacement string");
      }
      return o;
    }
    var caps = captures(ms, s, e, true);
    if (tr === 'table') v = index(repl, caps[0]);
    else v = first(call(repl).apply(null, caps));
    if (v === undefined || v === false) return whole;
    if (typeof v === 'string') return v;
    if (isNum(v)) return numStr(v);
    throw rterror('invalid replacement value (a ' + typeName(v) + ')');
  }

  // ===================================================== conversion =======
  // Between JS values (UTF-16 strings, arrays, objects) and Lua values.
  var encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  var decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null;
  function toBytes(str) {        // JS string -> Lua byte string
    if (/^[\x00-\x7f]*$/.test(str)) return str;
    var b = encoder.encode(str), s = '';
    for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return s;
  }
  function fromBytes(s) {        // Lua byte string -> JS string
    if (/^[\x00-\x7f]*$/.test(s)) return s;
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return decoder.decode(b);
  }
  function toLua(v) {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') return toBytes(v);
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'function') return v;
    if (v instanceof LuaTable || v instanceof LFloat) return v;
    var t = new LuaTable();
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) t.set(i + 1, toLua(v[i])); return t; }
    Object.keys(v).forEach(function (k) { t.set(toBytes(k), toLua(v[k])); });
    return t;
  }
  function toJS(v, seen) {
    if (v instanceof LFloat) return v.n;
    if (typeof v === 'string') return fromBytes(v);
    if (!(v instanceof LuaTable)) return v;
    seen = seen || new Map();
    if (seen.has(v)) return seen.get(v);
    var n = v.arr.length, hashSize = v.hash ? v.hash.size : 0;
    if (hashSize === 0) {
      var a = [];
      seen.set(v, a);
      for (var i = 0; i < n; i++) a.push(toJS(v.arr[i], seen));
      return a;
    }
    var o = {};
    seen.set(v, o);
    for (var j = 0; j < n; j++) if (v.arr[j] !== undefined) o[j + 1] = toJS(v.arr[j], seen);
    v.hash.forEach(function (val, key) {
      var k = typeof key === 'string' ? fromBytes(key) : (isNum(key) ? numStr(key) : tostring(key));
      o[k] = toJS(val, seen);
    });
    return o;
  }

  NS.LFloat = LFloat; NS.mkf = mkf; NS.Multi = Multi; NS.first = first; NS.sp = sp; NS.ret = ret;
  NS.LuaTable = LuaTable; NS.NONE = NONE; NS.LuaError = LuaError; NS.lineMaps = lineMaps;
  NS.add = add; NS.sub = sub; NS.mul = mul; NS.div = div; NS.idiv = idiv; NS.mod = mod; NS.pow = pow;
  NS.unm = unm; NS.band = band; NS.bor = bor; NS.bxor = bxor; NS.shl = shl; NS.shr = shr; NS.bnot = bnot;
  NS.concat = concat; NS.len = len; NS.eq = eq; NS.lt = lt; NS.le = le; NS.gt = gt; NS.ge = ge;
  NS.T = truthy; NS.index = index; NS.setindex = setindex; NS.call = call; NS.method = method;
  NS.tbl = tbl; NS.iter = iter; NS.forprep = forprep; NS.tostring = tostring; NS.typeName = typeName;
  NS.makeEnv = makeEnv; NS.toLua = toLua; NS.toJS = toJS; NS.toBytes = toBytes; NS.fromBytes = fromBytes;
  NS.numStr = numStr; NS.str2num = str2num; NS.errorValue = errorValue; NS.rterror = rterror;
})(typeof module === 'object' && module.exports
  ? (module.exports = (globalThis.MiddawLua = globalThis.MiddawLua || {}))
  : (globalThis.MiddawLua = globalThis.MiddawLua || {}));


/* ---- kit/runtime/lua_compile.js ---- */
/* Middaw's Lua 5.4, part 2 of 3: syntax tree in, JavaScript out.
 *
 * Every Lua local becomes a JS `let` with a name of its own ($x, $x$2...), so
 * shadowing and closures behave as in Lua: a fresh binding per declaration,
 * and per loop iteration. Every operator goes through the runtime, so the
 * integer/float distinction and the error messages are Lua's. Each statement
 * starts a new line carrying a marker with its Lua line number, which is how
 * an error raised in the generated code is reported at the Lua line.
 */
(function (NS) {
  'use strict';

  var ARITH = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'mod', '^': 'pow', '//': 'idiv',
                '&': 'band', '|': 'bor', '~': 'bxor', '<<': 'shl', '>>': 'shr', '..': 'concat' };
  var COMPARE = { '==': 'eq', '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' };

  function compile(ast, chunk) {
    var consts = [];
    var nameCounts = Object.create(null);

    function uniqueName(luaName) {
      var n = (nameCounts[luaName] || 0) + 1;
      nameCounts[luaName] = n;
      return n === 1 ? '$' + luaName : '$' + luaName + '$' + n;
    }

    function FuncState(parent, vararg) {
      this.parent = parent; this.vararg = vararg; this.temps = 0; this.scopes = [];
    }
    var fs = null;
    var stmtUid = 0;

    function newTemp() { fs.temps++; return '$$' + fs.temps; }
    function lookup(name) {
      for (var f = fs; f; f = f.parent) {
        for (var i = f.scopes.length - 1; i >= 0; i--) {
          var js = f.scopes[i][name];
          if (js !== undefined) return js;
        }
      }
      return null;
    }
    function declare(name) {
      var js = uniqueName(name);
      fs.scopes[fs.scopes.length - 1][name] = js;
      return js;
    }
    function openScope() { fs.scopes.push(Object.create(null)); }
    function closeScope() { fs.scopes.pop(); }

    function err(msg, line) {
      throw new NS.LuaSyntaxError(msg, chunk, line || 0);
    }

    function str(s) { return JSON.stringify(s); }

    function numberLiteral(text) {
      var v;
      if (/^0[xX]/.test(text)) {
        if (/[.pP]/.test(text)) v = NS.str2num(text);
        else {
          var big = BigInt.asIntN(64, BigInt('0x' + text.slice(2)));
          return String(Number(big));
        }
      } else if (/[.eE]/.test(text)) {
        v = NS.mkf(Number(text));
      } else {
        var n = Number(text);
        if (Math.abs(n) > 9223372036854775807) v = NS.mkf(n);
        else return String(n);
      }
      if (v instanceof NS.LFloat) {
        var idx = consts.length;
        consts.push(v);
        return '$$K[' + idx + ']';
      }
      var s = String(v);
      return s === 'Infinity' ? 'Infinity' : (s === 'NaN' ? 'NaN' : (v < 0 ? '(' + s + ')' : s));
    }

    function describe(e) {
      if (e.k === 'Name') return lookup(e.name) ? "local '" + e.name + "'" : "global '" + e.name + "'";
      if (e.k === 'Index' && e.key.k === 'String') return "field '" + e.key.v + "'";
      if (e.k === 'Method') return "method '" + e.name + "'";
      return '';
    }

    function isMultiExpr(e) { return e.k === 'Call' || e.k === 'Method' || e.k === 'Vararg'; }

    // A JS expression for the raw result of a call: possibly a Multi.
    function callRaw(e) {
      if (e.k === 'Method') {
        var o = ex(e.obj);
        var args = argList(e.args);
        return 'L.method(' + o + ', ' + str(e.name) + (args ? ', ' + args : '') + ')';
      }
      var fn = ex(e.fn), a = argList(e.args), d = describe(e.fn);
      if (/^\$[A-Za-z_][\w$]*$/.test(fn)) {
        return '(typeof ' + fn + " === 'function' ? " + fn + ' : L.call(' + fn + ', ' + str(d) + '))(' + a + ')';
      }
      var t = newTemp();
      return '(typeof (' + t + ' = ' + fn + ") === 'function' ? " + t + ' : L.call(' + t + ', ' + str(d) + '))(' + a + ')';
    }

    function argList(exprs) {
      var out = [];
      for (var i = 0; i < exprs.length; i++) {
        var e = exprs[i], last = i === exprs.length - 1;
        if (last && (e.k === 'Call' || e.k === 'Method')) out.push('...L.sp(' + callRaw(e) + ')');
        else if (last && e.k === 'Vararg') { checkVararg(e); out.push('...$$va'); }
        else out.push(ex(e));
      }
      return out.join(', ');
    }
    function checkVararg(e) {
      if (!fs.vararg) err("cannot use '...' outside a vararg function", e.line);
    }

    // A JS expression for exactly one Lua value.
    function ex(e) {
      switch (e.k) {
        case 'Nil': return 'undefined';
        case 'True': return 'true';
        case 'False': return 'false';
        case 'Number': return numberLiteral(e.v);
        case 'String': return str(e.v);
        case 'Vararg': checkVararg(e); return '$$va[0]';
        case 'Function': return funcExpr(e);
        case 'Paren': return ex(e.expr);
        case 'Name': {
          var js = lookup(e.name);
          if (js) return js;
          return 'L.index($$G, ' + str(e.name) + ')';
        }
        case 'Index':
          return 'L.index(' + ex(e.obj) + ', ' + ex(e.key) + ', ' + str(describe(e.obj)) + ')';
        case 'Call': case 'Method':
          return 'L.first(' + callRaw(e) + ')';
        case 'Table': return tableExpr(e);
        case 'Unop': {
          if (e.op === 'not') return '!' + cond(e.expr);
          if (e.op === '-') {
            if (e.expr.k === 'Number') {
              var lit = numberLiteral(e.expr.v);
              if (/^\d+$/.test(lit)) return lit === '0' ? '0' : '(-' + lit + ')';
              if (/^[\d.e+-]+$/.test(lit)) return '(-' + lit + ')';
            }
            return 'L.unm(' + ex(e.expr) + ')';
          }
          if (e.op === '#') return 'L.len(' + ex(e.expr) + ')';
          if (e.op === '~') return 'L.bnot(' + ex(e.expr) + ')';
          break;
        }
        case 'Binop': {
          if (e.op === 'and') {
            var t = newTemp();
            return '(L.T(' + t + ' = ' + ex(e.left) + ') ? ' + ex(e.right) + ' : ' + t + ')';
          }
          if (e.op === 'or') {
            var t2 = newTemp();
            return '(L.T(' + t2 + ' = ' + ex(e.left) + ') ? ' + t2 + ' : ' + ex(e.right) + ')';
          }
          if (e.op === '~=') return '!L.eq(' + ex(e.left) + ', ' + ex(e.right) + ')';
          if (COMPARE[e.op]) return 'L.' + COMPARE[e.op] + '(' + ex(e.left) + ', ' + ex(e.right) + ')';
          return 'L.' + ARITH[e.op] + '(' + ex(e.left) + ', ' + ex(e.right) + ')';
        }
      }
      err('cannot compile expression ' + e.k, e.line);
    }

    // A JS boolean expression for Lua truth, without building a Lua value.
    function cond(e) {
      switch (e.k) {
        case 'True': return 'true';
        case 'False': case 'Nil': return 'false';
        case 'Paren': return cond(e.expr);
        case 'Unop': if (e.op === 'not') return '!' + cond(e.expr); break;
        case 'Binop':
          if (e.op === 'and') return '(' + cond(e.left) + ' && ' + cond(e.right) + ')';
          if (e.op === 'or') return '(' + cond(e.left) + ' || ' + cond(e.right) + ')';
          if (e.op === '~=' || COMPARE[e.op]) return ex(e);
          break;
      }
      return 'L.T(' + ex(e) + ')';
    }

    function tableExpr(e) {
      var pos = [], keyed = [];
      for (var i = 0; i < e.items.length; i++) {
        var it = e.items[i];
        if (it.kind === 'pos') {
          var lastPos = true;
          for (var j = i + 1; j < e.items.length; j++) if (e.items[j].kind === 'pos') { lastPos = false; break; }
          if (lastPos && (it.value.k === 'Call' || it.value.k === 'Method')) pos.push('...L.sp(' + callRaw(it.value) + ')');
          else if (lastPos && it.value.k === 'Vararg') { checkVararg(it.value); pos.push('...$$va'); }
          else pos.push(ex(it.value));
        } else {
          keyed.push(ex(it.key), ex(it.value));
        }
      }
      if (!keyed.length) return 'L.tbl([' + pos.join(', ') + '])';
      return 'L.tbl([' + pos.join(', ') + '], [' + keyed.join(', ') + '])';
    }

    function funcExpr(f) {
      var saved = fs;
      fs = new FuncState(saved, f.vararg);
      openScope();
      var params = f.params.map(function (p) { return declare(p); });
      if (f.vararg) params.push('...$$va');
      var body = block(f.body);
      closeScope();
      var temps = '';
      if (fs.temps) {
        var names = [];
        for (var i = 1; i <= fs.temps; i++) names.push('$$' + i);
        temps = 'let ' + names.join(', ') + ';';
      }
      fs = saved;
      return 'function (' + params.join(', ') + ') {' + temps + body + '\n/*@' + (f.endLine || f.line) + '*/return L.NONE;}';
    }

    function block(stmts) {
      var out = '';
      for (var i = 0; i < stmts.length; i++) out += statement(stmts[i]);
      return out;
    }
    function scoped(stmts) {
      openScope();
      var b = block(stmts);
      closeScope();
      return b;
    }

    function assignTo(target, value) {
      if (target.k === 'Name') {
        var js = lookup(target.name);
        if (js) return js + ' = ' + value + ';';
        return 'L.setindex($$G, ' + str(target.name) + ', ' + value + ');';
      }
      return 'L.setindex(' + ex(target.obj) + ', ' + ex(target.key) + ', ' + value + ', ' + str(describe(target.obj)) + ');';
    }

    function valuesArray(exprs) { return '[' + argList(exprs) + ']'; }

    function statement(s) {
      var mark = '\n/*@' + (s.line || 0) + '*/';
      switch (s.k) {
        case 'Local': {
          var attrs = s.attribs || [];
          attrs.forEach(function (a) {
            if (a && a !== 'const' && a !== 'close') err("unknown attribute '" + a + "'", s.line);
          });
          if (s.names.length === 1 && s.exprs.length <= 1) {
            var v = s.exprs.length ? ex(s.exprs[0]) : 'undefined';
            return mark + 'let ' + declare(s.names[0]) + ' = ' + v + ';';
          }
          if (s.exprs.length === s.names.length && !s.exprs.some(isMultiExpr)) {
            var vals = s.exprs.map(ex);
            var tmpNames = vals.map(function () { return '$$l' + (++stmtUid); });
            var pre = 'const ' + tmpNames.map(function (t, i) { return t + ' = ' + vals[i]; }).join(', ') + ';';
            var decl = s.names.map(function (n, i) { return declare(n) + ' = ' + tmpNames[i]; });
            return mark + pre + ' let ' + decl.join(', ') + ';';
          }
          var r = '$$r' + (++stmtUid);
          var code = 'const ' + r + ' = ' + valuesArray(s.exprs) + ';';
          var decls = s.names.map(function (n, i) { return declare(n) + ' = ' + r + '[' + i + ']'; });
          return mark + code + ' let ' + decls.join(', ') + ';';
        }
        case 'LocalFunction': {
          var name = declare(s.name);
          return mark + 'let ' + name + '; ' + name + ' = ' + funcExpr(s.func) + ';';
        }
        case 'Assign': {
          if (s.targets.length === 1 && s.exprs.length === 1) {
            return mark + assignTo(s.targets[0], ex(s.exprs[0]));
          }
          var rr = '$$r' + (++stmtUid);
          var c2 = 'const ' + rr + ' = ' + valuesArray(s.exprs) + ';';
          s.targets.forEach(function (t, i) { c2 += ' ' + assignTo(t, rr + '[' + i + ']'); });
          return mark + c2;
        }
        case 'ExprStat':
          return mark + callRaw(s.expr) + ';';
        case 'Do':
          return mark + '{' + scoped(s.body) + '\n}';
        case 'While':
          return mark + 'while (' + cond(s.cond) + ') {' + scoped(s.body) + '\n}';
        case 'Repeat': {
          openScope();
          var body = block(s.body);
          var cnd = cond(s.cond);
          closeScope();
          return mark + 'for (;;) {' + body + '\nif (' + cnd + ') break;\n}';
        }
        case 'If': {
          var o = mark;
          s.clauses.forEach(function (c, i) {
            o += (i ? ' else if (' : 'if (') + cond(c.cond) + ') {' + scoped(c.body) + '\n}';
          });
          if (s.orelse) o += ' else {' + scoped(s.orelse) + '\n}';
          return o;
        }
        case 'NumFor': {
          var u = ++stmtUid;
          var I = '$$i' + u, LIM = '$$m' + u, ST = '$$s' + u, FL = '$$f' + u;
          var start = ex(s.start), limit = ex(s.limit);
          var stepLit = !s.step ? 1 : (s.step.k === 'Number' && /^\d+$/.test(s.step.v) ? Number(s.step.v) : null);
          var step = s.step ? ex(s.step) : '1';
          var intStart = s.start.k === 'Number' && /^\d+$/.test(s.start.v);
          var test = stepLit !== null && stepLit > 0 ? I + ' <= ' + LIM : '(' + ST + ' > 0 ? ' + I + ' <= ' + LIM + ' : ' + I + ' >= ' + LIM + ')';
          openScope();
          var v2 = declare(s.name);
          var bindVal = (intStart && stepLit !== null) ? I : FL + ' ? L.mkf(' + I + ') : ' + I;
          var bd = block(s.body);
          closeScope();
          return mark + 'for (let [' + I + ', ' + LIM + ', ' + ST + ', ' + FL + '] = L.forprep(' + start + ', ' + limit + ', ' + step + '); ' +
                 test + '; ' + I + ' += ' + ST + ') { let ' + v2 + ' = ' + bindVal + ';' + bd + '\n}';
        }
        case 'GenFor': {
          var it = '$$it' + (++stmtUid);
          var head = 'const ' + it + ' = L.iter(' + argList(s.exprs) + ');';
          openScope();
          var binds = s.names.map(function (n, i) {
            var src = i === 0 ? it + '.a' : (i === 1 ? it + '.b' : it + '.v[' + i + ']');
            return declare(n) + ' = ' + src;
          });
          var gb = block(s.body);
          closeScope();
          return mark + '{' + head + ' while (' + it + '.step()) { let ' + binds.join(', ') + ';' + gb + '\n}}';
        }
        case 'Return': {
          var ex0 = s.exprs;
          if (!ex0.length) return mark + 'return L.NONE;';
          if (ex0.length === 1) {
            if (ex0[0].k === 'Call' || ex0[0].k === 'Method') return mark + 'return ' + callRaw(ex0[0]) + ';';
            if (ex0[0].k === 'Vararg') { checkVararg(ex0[0]); return mark + 'return L.ret($$va);'; }
            return mark + 'return ' + ex(ex0[0]) + ';';
          }
          return mark + 'return L.ret(' + valuesArray(ex0) + ');';
        }
        case 'Break': return mark + 'break;';
        case 'Goto': case 'Label':
          err('goto and labels are not supported by Middaw\'s Lua', s.line);
      }
      err('cannot compile statement ' + s.k, s.line);
    }

    fs = new FuncState(null, true);
    openScope();
    var body = block(ast.body);
    closeScope();
    var temps = '';
    if (fs.temps) {
      var names = [];
      for (var i = 1; i <= fs.temps; i++) names.push('$$' + i);
      temps = 'let ' + names.join(', ') + ';';
    }
    return { body: temps + body, consts: consts };
  }

  // The line the first line of a `new Function` body is reported as.
  var lineOffset = null;
  function probeOffset() {
    if (lineOffset !== null) return lineOffset;
    try {
      new Function('throw new Error("probe");\n//# sourceURL=lua:__probe__')();
    } catch (e) {
      var m = /lua:__probe__:(\d+)/.exec(e.stack || '');
      lineOffset = m ? Number(m[1]) - 1 : 0;
    }
    return lineOffset;
  }

  var chunkUid = 0;
  // Lua source (a byte string) -> a JS function, as `load` gives it.
  function load(src, chunkname, env) {
    var name = String(chunkname || 'chunk').replace(/[^A-Za-z0-9_.\/-]/g, '_');
    if (NS.lineMaps[name]) name = name + '#' + (++chunkUid);
    var ast = NS.parse(src, name);
    var out = compile(ast, name);
    var code = 'return function (...$$va) {' + out.body + '\nreturn L.NONE;\n};';
    var offset = probeOffset();
    var lines = code.split('\n'), map = [], cur = 0;
    for (var i = 0; i < offset; i++) map.push(0);
    for (var j = 0; j < lines.length; j++) {
      var m = /^\/\*@(\d+)\*\//.exec(lines[j]);
      if (m) cur = Number(m[1]);
      map.push(cur);
    }
    NS.lineMaps[name.replace(/#/g, '_')] = map;
    var factory = new Function('L', '$$G', '$$K', code + '\n//# sourceURL=lua:' + name.replace(/#/g, '_'));
    return factory(NS, env || NS.defaultEnv(), out.consts);
  }

  var sharedEnv = null;
  NS.defaultEnv = function () { return sharedEnv || (sharedEnv = NS.makeEnv()); };
  NS.compile = compile;
  NS.load = load;
})(typeof module === 'object' && module.exports
  ? (module.exports = (globalThis.MiddawLua = globalThis.MiddawLua || {}))
  : (globalThis.MiddawLua = globalThis.MiddawLua || {}));


/* ---- kit/runtime/host.js ---- */
/* The family's Lua engines, spoken to in JSON.
 *
 * The native app runs this in JavaScriptCore, after the Lua runtime
 * (runtime/lua/), and calls `MiddawHost.call(method, argsJSON)`; the tests run
 * it in Node. It knows no browser and no files: the host hands it a
 * `readFile(path)` that returns the file's bytes as a string, one character
 * per byte, which is how Middaw's Lua keeps its strings.
 *
 * The adapters (Noterator's) are how the generators are spoken to - settings
 * in, notes out - the same protocol Miderator and Noterator use.
 */
(function (G) {
  'use strict';
  var L = G.MiddawLua;

  var FILES = [
    'good-idea/gi_theory.lua', 'good-idea/gi_idea.lua',
    'midi-catalogue/mc_theory.lua', 'midi-catalogue/mc_orchestra.lua', 'midi-catalogue/mc_catalogue.lua',
    'midi-suggester/ms_theory.lua', 'midi-suggester/ms_read.lua', 'midi-suggester/ms_harmony.lua', 'midi-suggester/ms_melody.lua',
    'midi-variator/mv_theory.lua', 'midi-variator/mv_vary.lua',
    'starting-blocks/sb_engine.lua',
    'adapters/common.lua', 'adapters/index.lua', 'adapters/good_idea.lua', 'adapters/midi_suggester.lua',
    'adapters/midi_variator.lua', 'adapters/starting_blocks.lua', 'adapters/midi_catalogue.lua',
    'notation/sb_notate.lua', 'notation/sb_draw.lua', 'notation/sb_glyphs.lua',
    'battle-pass/bp_theory.lua', 'battle-pass/bp_loot.lua', 'battle-pass/bp_game.lua',
    'orchestration/orchestration_data.lua', 'orchestration/orchestration_composers.lua'
  ];

  var readFile = null, modules = {}, env = null, log = function () {};

  function engine(name) {
    if (modules[name] === undefined) {
      var src = readFile(name);
      if (src === null || src === undefined) throw new Error("engine '" + name + "' is not there");
      var r = L.first(L.load(src, name, env)());
      modules[name] = r === undefined ? false : r;
    }
    return modules[name];
  }

  function init(reader, logger) {
    readFile = reader;
    if (logger) log = logger;
    modules = {};
    env = L.makeEnv({
      print: function (s) { log('[lua] ' + L.fromBytes(s)); },
      readFile: function () { return null; },
      writeFile: function () {}
    });
    env.set('engine', function (name) { return engine(name); });
    env.set('dofile', function (name) { return L.first(engine(String(name).replace(/^.*engines\//, ''))); });
    return true;
  }

  function call(mod, fname) {
    var m = typeof mod === 'string' ? engine(mod) : mod;
    var f = L.index(m, fname);
    var args = [];
    for (var i = 2; i < arguments.length; i++) {
      var a = arguments[i];
      args.push(a instanceof L.LuaTable ? a : L.toLua(a));
    }
    return L.first(L.call(f).apply(null, args));
  }
  function js(v) { return L.toJS(v); }
  function list(x) { return !x ? [] : Array.isArray(x) ? x : Object.keys(x).map(function (k) { return x[k]; }); }

  // --------------------------------------------------------- generators --
  var adapters = null;
  function gens() {
    if (adapters) return adapters;
    adapters = list(js(engine('adapters/index.lua'))).map(function (path) {
      var A = engine(path);
      return { id: js(L.index(A, 'id')), name: js(L.index(A, 'name')), description: js(L.index(A, 'description')) || '',
               input: js(L.index(A, 'input')), panel: js(L.index(A, 'panel')) || null, A: A, path: path };
    });
    return adapters;
  }
  function gen(id) {
    var l = gens();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    throw new Error('no generator ' + id);
  }

  // A generator's settings live in Lua, as the engine left them.
  var sessions = {}, nextSession = 1;
  function session(id) { var s = sessions[id]; if (!s) throw new Error('no session ' + id); return s; }
  function normalise(r) {
    r = r || { results: [] };
    r.results = list(r.results);
    r.results.forEach(function (res) {
      res.parts = list(res.parts);
      res.parts.forEach(function (p) { p.notes = list(p.notes); });
    });
    return r;
  }

  // ------------------------------------------------------------- theory --
  // Chord names are ScaleView's, read by Midi Variator's port of it.
  // mv_theory knows the seven-note scales; anything else names chords
  // against the parallel major or minor. Indexed by ScaleView's scale (1-16).
  var MV_SCALE = [1, 2, 3, 1, 4, 5, 6, 7, 2, 1, 2, 1, 2, 1, 2, 1];
  var keyCache = {};
  function luaKey(key) {
    var k = key.root + ':' + key.scale;
    if (!keyCache[k]) keyCache[k] = call('midi-variator/mv_theory.lua', 'key', key.root, MV_SCALE[key.scale - 1] || 1);
    return keyCache[k];
  }

  // -------------------------------------------------------- orchestra ----
  // Noterator's instruments beyond the orchestra (Source/Core/Instruments.cpp).
  var EXTRA = [
    { id: 'asax', name: 'Alto Saxophone', family: 'Woodwind', low: 49, high: 80, sweet: [53, 76], poly: 1, fast: 0.09, leap: 12 },
    { id: 'tsax', name: 'Tenor Saxophone', family: 'Woodwind', low: 44, high: 75, sweet: [48, 70], poly: 1, fast: 0.09, leap: 12 },
    { id: 'bsax', name: 'Baritone Saxophone', family: 'Woodwind', low: 36, high: 69, sweet: [40, 62], poly: 1, fast: 0.10, leap: 12 },
    { id: 'vib', name: 'Vibraphone', family: 'Percussion', low: 53, high: 89, sweet: [55, 84], poly: 4, fast: 0.09, leap: 12 },
    { id: 'sop', name: 'Soprano', family: 'Voices', low: 60, high: 81, sweet: [64, 77], poly: 1, fast: 0.15, leap: 9 },
    { id: 'alto', name: 'Alto', family: 'Voices', low: 53, high: 74, sweet: [57, 69], poly: 1, fast: 0.15, leap: 9 },
    { id: 'ten', name: 'Tenor', family: 'Voices', low: 48, high: 69, sweet: [50, 65], poly: 1, fast: 0.15, leap: 9 },
    { id: 'bass', name: 'Bass', family: 'Voices', low: 40, high: 64, sweet: [43, 60], poly: 1, fast: 0.15, leap: 9 },
    { id: 'gtr', name: 'Guitar', family: 'Band', low: 40, high: 83, sweet: [45, 76], poly: 6, fast: 0.08, leap: 12 },
    { id: 'ebass', name: 'Bass Guitar', family: 'Band', low: 28, high: 67, sweet: [28, 55], poly: 1, fast: 0.09, leap: 12 },
    { id: 'ubass', name: 'Upright Bass', family: 'Band', low: 28, high: 67, sweet: [28, 55], poly: 1, fast: 0.10, leap: 12 },
    { id: 'synth', name: 'Synth', family: 'Band', low: 24, high: 108, sweet: [36, 96], poly: 16, fast: 0.03, leap: 48 },
    { id: 'kit', name: 'Drum Kit', family: 'Band', low: 35, high: 81, sweet: [35, 81], poly: 4, fast: 0.05, leap: 127, drums: true }
  ];

  // ----------------------------------------------------------- notation --
  var notate = null;
  function notation() {
    if (notate) return notate;
    var N = engine('notation/sb_notate.lua'), D = engine('notation/sb_draw.lua'), Gl = engine('notation/sb_glyphs.lua');
    L.call(L.index(D, 'setNotate'))(N);
    L.call(L.index(D, 'setGlyphs'))(Gl);
    notate = { N: N, D: D, E: engine('starting-blocks/sb_engine.lua') };
    return notate;
  }
  // A pen that records what Starting Blocks Notation draws, for the native
  // side to replay. sb_draw.lua uses four calls; colours arrive as the ids
  // given to it (1 ink, 2 staff, 3 ground, 4 accent):
  //   ["line", x1, y1, x2, y2, colour, thickness]
  //   ["poly", [x, y, x, y, ...], colour]
  //   ["circle", x, y, r, colour, filled]
  //   ["text", x, y, colour, text, size, centred]
  function num(v) { return v instanceof L.LFloat ? v.n : +v; }
  function colour(c) { return c instanceof L.LuaTable ? js(c) : num(c); }
  function recordingPen(ops) {
    var pen = new L.LuaTable();
    pen.set('line', function (x1, y1, x2, y2, col, th) {
      ops.push(['line', num(x1), num(y1), num(x2), num(y2), colour(col), th === undefined ? 1 : num(th)]); return L.NONE;
    });
    pen.set('poly', function (pts, col) {
      ops.push(['poly', pts.arr.map(num), colour(col)]); return L.NONE;
    });
    pen.set('circle', function (x, y, r, col, filled) {
      ops.push(['circle', num(x), num(y), num(r), colour(col), !!L.T(filled)]); return L.NONE;
    });
    pen.set('text', function (x, y, col, str, size, center) {
      ops.push(['text', num(x), num(y), colour(col), L.fromBytes(L.tostring(str)), num(size), !!L.T(center)]); return L.NONE;
    });
    return pen;
  }

  // ---------------------------------------------------------- the pass ---
  var pass = null, passState = null, passSession = null;
  function battlePass() {
    if (pass) return pass;
    var T = engine('battle-pass/bp_theory.lua');
    var Lt = L.first(L.call(L.index(engine('battle-pass/bp_loot.lua'), 'init'))(T));
    var Gm = L.first(L.call(L.index(engine('battle-pass/bp_game.lua'), 'init'))(Lt));
    pass = { G: Gm, L: Lt, T: T };
    return pass;
  }

  // ------------------------------------------------------------- methods -
  var M = {
    generators: function () {
      return gens().map(function (g) { return { id: g.id, name: g.name, description: g.description, input: g.input, panel: g.panel }; });
    },
    newSession: function (a) {
      var g = gen(a.generator), id = nextSession++;
      sessions[id] = { g: g, st: L.first(L.call(L.index(g.A, 'newState'))()) };
      return id;
    },
    useKey: function (a) { var s = session(a.session); call(s.g.A, 'useKey', s.st, a.key.root, a.key.scale); return true; },
    settings: function (a) { var s = session(a.session); return list(js(call(s.g.A, 'settings', s.st, L.toLua(a.context || {})))); },
    set: function (a) { var s = session(a.session); call(s.g.A, 'set', s.st, a.setting, a.index, L.toLua(a.context || {})); return true; },
    generate: function (a) {
      var s = session(a.session);
      return normalise(js(call(s.g.A, 'generate', s.st, L.toLua(a.context || {}), a.seed || 1, a.count || 6)));
    },
    snapshot: function (a) { return js(session(a.session).st); },
    restore: function (a) {
      var s = session(a.session);
      Object.keys(a.state || {}).forEach(function (k) { L.setindex(s.st, L.toBytes(k), L.toLua(a.state[k])); });
      return true;
    },
    closeSession: function (a) { delete sessions[a.session]; return true; },

    nameChord: function (a) {
      if (!a.pitches || a.pitches.length < 2) return '';
      var r = L.call(L.index(engine('midi-variator/mv_theory.lua'), 'nameChord'))(L.toLua(a.pitches), luaKey(a.key));
      return js(L.first(r)) || '';
    },
    noteNames: function (a) {
      var k = js(L.index(luaKey(a.key), 'names')), out = [];
      for (var pc = 0; pc < 12; pc++) out.push(k[pc] || k[String(pc)] || '');
      return out;
    },
    // Midi Variator's key finder (ScaleView's), as Miderator's key lane uses it.
    detectKey: function (a) {
      var notes = (a.notes || []).slice().sort(function (x, y) { return x.start - y.start; });
      if (!notes.length) return null;
      var r = list(js(call('midi-variator/mv_theory.lua', 'detectKey',
        notes.map(function (n) { return { pitch: n.pitch, start: n.start, len: n.len }; }),
        notes[0].pitch % 12, notes[notes.length - 1].pitch % 12)));
      if (!r.length) return null;
      return { root: r[0].root, scale: r[0].scale === 2 ? 2 : 1 };
    },
    // Midi Catalogue's orchestra, plus Noterator's band and voices.
    instruments: function () {
      return list(js(L.index(engine('midi-catalogue/mc_orchestra.lua'), 'INSTRUMENTS'))).concat(EXTRA);
    },
    orchestration: function () {
      var A = js(engine('orchestration/orchestration_data.lua'));
      var B = js(engine('orchestration/orchestration_composers.lua'));
      return { entries: list(A.ENTRIES).concat(list(B && B.ENTRIES)),
               sources: Object.assign({}, (B && B.SOURCES) || {}, A.SOURCES || {}) };
    },

    // A part engraved by Starting Blocks Notation: its height and the drawing,
    // as a list of pen calls in staff spaces of `space` points.
    engrave: function (a) {
      var nt = notation();
      var st = L.first(L.call(L.index(nt.E, 'newState'))());
      st.set('root', a.key.root); st.set('scale', a.key.scale); st.set('barBeats', a.barBeats);
      var ctx = L.first(L.call(L.index(nt.N, 'context'))(nt.E, st));
      var block = L.toLua({ notes: a.notes, beats: a.beats, name: a.name || '' });
      var opts = L.toLua({ barBeats: a.barBeats, tsNum: a.meter[0], tsDen: a.meter[1], width: a.width,
                           drums: !!a.drums, grid: a.drums ? 0.25 : undefined,
                           // a clip is as played, so its silences are rests (Starting Blocks Notation 0019)
                           rests: !a.drums });
      opts.set('ctx', ctx);
      var doc = L.first(L.call(L.index(nt.N, 'layout'))(block, opts));
      var height = +L.first(L.call(L.index(nt.D, 'height'))(doc, a.space));
      var ops = [];
      var colours = L.toLua({ ink: 1, staff: 2, ground: 3, accent: 4 });
      var popts = new L.LuaTable();
      if (a.highlight !== undefined && a.highlight >= 0) {
        var at = a.highlight * 960;
        popts.set('highlight', function (el) {
          var abs = L.index(el, 'abs'), ticks = L.index(el, 'ticks');
          return abs !== undefined && at >= +abs && at < +abs + +ticks;
        });
      }
      L.call(L.index(nt.D, 'page'))(recordingPen(ops), doc, 0, 0, a.space, colours, popts);
      return { height: height, ops: ops };
    },

    // The Battle Pass, unchanged: its state is the game's own text.
    // `clock` is seconds of activity time, `epoch` the wall clock in seconds.
    passStart: function (a) {
      var Gm = battlePass().G;
      passState = a.saved ? L.first(L.call(L.index(Gm, 'deserialize'))(L.toBytes(a.saved))) : undefined;
      if (!passState) passState = L.first(L.call(L.index(Gm, 'newState'))(a.epoch));
      L.call(L.index(Gm, 'clampState'))(passState, a.epoch);
      passSession = L.first(L.call(L.index(Gm, 'newSession'))(passState, a.clock, a.epoch));
      L.call(L.index(Gm, 'refresh'))(passState, passSession, a.epoch, new L.LuaTable());
      return true;
    },
    // Any bp_game function; "$state" and "$session" in `args` stand for the
    // game's own tables.
    passCall: function (a) {
      var args = (a.args || []).map(function (x) {
        return x === '$state' ? passState : x === '$session' ? passSession : L.toLua(x);
      });
      return js(L.first(L.call(L.index(battlePass().G, a.fn)).apply(null, args)));
    },
    // What the game wants celebrated since last asked, then forgotten.
    passNotices: function () {
      var l = L.index(passSession, 'notices');
      if (!l || !l.arr || !l.arr.length) return [];
      var out = l.arr.map(function (n) { return js(n); });
      l.arr.length = 0;
      return out;
    },
    passGet: function (a) {
      var v = passState;
      String(a.path).split('.').forEach(function (k) { v = v === undefined ? undefined : L.index(v, isNaN(+k) ? k : +k); });
      return v instanceof L.LFloat ? v.n : js(v);
    },
    // Middaw's composer (runtime/composer/, the port of middaw/): a sentence
    // in, the song's five parts out, exactly as `python3 -m middaw --json`
    // answers. composerLoad takes data/vocab/tags.json and drums.json as text.
    composerLoad: function (a) {
      if (!G.MiddawComposer || !G.MiddawComposer.load) throw new Error('the composer is not loaded');
      G.MiddawComposer.load(JSON.parse(a.tags), JSON.parse(a.drums));
      return true;
    },
    compose: function (a) {
      var C = G.MiddawComposer;
      if (!C || !C.vocabulary) throw new Error('the composer has no vocabulary');
      return C.compose(String(a.prompt || ''), a.seed === undefined || a.seed === null ? undefined : a.seed);
    },

    // The game's own tables that are not state: the shop, the check-in
    // calendar, the rarities (module 'loot').
    passConst: function (a) {
      var P = battlePass();
      var v = L.index(a.module === 'loot' ? P.L : P.G, String(a.name));
      // a list that is also indexed by name (G.SHOP[id]) is its list
      if (v instanceof L.LuaTable && L.index(v, 1) != null) {
        var out = [];
        for (var i = 1; L.index(v, i) != null; i++) out.push(js(L.index(v, i)));
        return out;
      }
      return js(v);
    },
    passSave: function () { return L.fromBytes(L.first(L.call(L.index(battlePass().G, 'serialize'))(passState))); },

    // AutoCC (the JSFX, unchanged) run over a clip's notes: the curves it
    // would play, as controller lanes {number: [[beat, value], ...]}. Only a
    // point where the value turns is kept, not every step.
    autoCC: function (a) {
      var J = G.MiddawJSFX;
      if (!J) throw new Error('the JSFX runtime is not loaded');
      var fx = new J.JSFX(a.source, {});
      Object.keys(a.sliders || {}).forEach(function (k) { fx.setSliderByIndex(Number(k), a.sliders[k]); });
      var sr = 48000, bs = 256;
      fx.init(sr);
      fx.setTime({ tempo: a.tempo, playState: 1, num: a.meter[0], den: a.meter[1] });
      var ev = [];
      (a.notes || []).forEach(function (n) {
        ev.push([n.start, [0x90, n.pitch, n.vel]]);
        ev.push([n.start + n.len, [0x80, n.pitch, 0]]);
      });
      ev.sort(function (x, y) { return x[0] - y[0]; });
      var spb = sr * 60 / a.tempo, total = Math.ceil(a.length * spb / bs) + 8, k = 0, lanes = {};
      for (var b = 0; b < total; b++) {
        var midi = [];
        while (k < ev.length && ev[k][0] * spb < (b + 1) * bs) {
          midi.push({ offset: Math.max(0, Math.round(ev[k][0] * spb - b * bs)), data: ev[k][1] }); k++;
        }
        fx.setTime({ beat: b * bs / spb, seconds: b * bs / sr });
        fx.process(bs, null, null, midi).forEach(function (m) {
          if ((m.data[0] & 0xF0) !== 0xB0) return;
          var beat = (b * bs + m.offset) / spb;
          if (beat > a.length) return;
          (lanes[m.data[1]] = lanes[m.data[1]] || []).push([Math.round(beat * 1000) / 1000, m.data[2]]);
        });
      }
      Object.keys(lanes).forEach(function (num) {
        var pts = lanes[num], out = [];
        pts.forEach(function (pt, i) {
          var prev = out[out.length - 1];
          if (!prev || i === pts.length - 1 || Math.abs(pt[1] - prev[1]) >= 2) out.push(pt);
        });
        lanes[num] = out;
      });
      return lanes;
    }
  };

  G.MiddawHost = {
    FILES: FILES,
    init: init,
    // The one entry point the native side uses: JSON in, JSON out, errors
    // returned rather than thrown so they cross the bridge as text.
    call: function (method, argsJSON) {
      try {
        if (!M[method]) throw new Error('no method ' + method);
        var r = M[method](argsJSON ? JSON.parse(argsJSON) : {});
        return JSON.stringify({ ok: true, value: r === undefined ? null : r });
      } catch (e) {
        var msg = e && (e.message || (e.value !== undefined ? String(L.tostring ? L.tostring(e.value) : e.value) : String(e)));
        return JSON.stringify({ ok: false, error: msg || 'error' });
      }
    },
    methods: M
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);


/* ---- kit/ui.js ---- */
/* The family's look, drawn with Max's mgraphics in a [v8ui].
 *
 * Colours are Middaw's HousePalette (MiddawCore/Palette.swift): cool greys,
 * the yellow accent for what is on, every word 7:1 on its surface. A control
 * registers its rectangle while it is painted, so a click goes to whatever
 * was drawn under it last paint - no layout is kept twice.
 */
var UI = (function () {
  'use strict';
  function rgb(hex, a) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, a === undefined ? 1 : a];
  }
  var C = {
    accent: rgb(0xFFF200), accentHeld: rgb(0xD1C600), control: rgb(0xA9AFBA), controlHeld: rgb(0x8F96A2),
    ground: rgb(0x23272E), raised: rgb(0x2A2F37), sunken: rgb(0x1A1D23), rule: rgb(0x3A404A),
    edge: rgb(0x6D7581), ink: rgb(0x14171C), text: rgb(0xDDE1E7), dim: rgb(0xB6BCC6),
    label: rgb(0xBFC5CE), warn: rgb(0xD2483F), warnText: rgb(0xFFA6A0)
  };

  var g = null, hits = [], drag = null, FONT = 'Arial';

  function begin(graphics) {
    g = graphics;
    hits = [];
    g.select_font_face(FONT);
  }
  function fill(c) { g.set_source_rgba(c[0], c[1], c[2], c[3]); }
  function rect(x, y, w, h, c) { fill(c); g.rectangle(x, y, w, h); g.fill(); }
  function round(x, y, w, h, r, c) { fill(c); g.rectangle_rounded(x, y, w, h, r, r); g.fill(); }
  function frame(x, y, w, h, c) { fill(c); g.set_line_width(1); g.rectangle(x + 0.5, y + 0.5, w - 1, h - 1); g.stroke(); }
  function measure(s, size) { g.set_font_size(size || 10); var m = g.text_measure(String(s)); return m[0]; }

  // Text cut to fit, with an ellipsis, so a long name never runs into the next control.
  function fit(s, w, size) {
    s = String(s);
    if (measure(s, size) <= w) return s;
    while (s.length > 1 && measure(s + '…', size) > w) s = s.slice(0, -1);
    return s + '…';
  }
  // align: 0 left, 1 centre, 2 right; y is the box top, h its height.
  function text(s, x, y, w, h, c, size, align, bold) {
    size = size || 10;
    g.select_font_face(FONT, 'normal', bold ? 'bold' : 'normal');
    g.set_font_size(size);
    var t = fit(s, w, size), tw = measure(t, size);
    var tx = align === 1 ? x + (w - tw) / 2 : align === 2 ? x + w - tw : x;
    fill(c);
    g.move_to(tx, y + h / 2 + size * 0.36);
    g.show_text(t);
    g.select_font_face(FONT, 'normal', 'normal');
  }

  function hit(x, y, w, h, handler) { hits.push({ x: x, y: y, w: w, h: h, fn: handler }); }
  function find(px, py) {
    for (var i = hits.length - 1; i >= 0; i--) {
      var r = hits[i];
      if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return r;
    }
    return null;
  }

  // A push button: title-style words, ink on the control grey, accent when on.
  function button(label, x, y, w, h, on, handler, enabled) {
    var off = enabled === false;
    round(x, y, w, h, 3, off ? C.raised : on ? C.accent : C.control);
    text(label, x + 4, y, w - 8, h, off ? C.dim : C.ink, 10, 1, true);
    if (!off) hit(x, y, w, h, { click: handler });
  }

  // A value chosen from a list: click the left third for the one before, the
  // rest for the one after, or drag up and down through them.
  function stepper(label, names, index, x, y, w, onChange) {
    text(label, x, y, w, 12, C.label, 9, 0);
    var by = y + 13, bh = 18;
    round(x, by, w, bh, 3, C.sunken);
    frame(x, by, w, bh, C.rule);
    text('‹', x + 3, by, 8, bh, C.dim, 11, 1);
    text('›', x + w - 11, by, 8, bh, C.dim, 11, 1);
    text(names[index - 1] === undefined ? '' : names[index - 1], x + 12, by, w - 24, bh, C.text, 10, 1);
    var n = names.length;
    var last = index;
    function to(i) { i = Math.max(1, Math.min(n, i)); if (i !== last) { last = i; onChange(i); } }
    hit(x, by, w, bh, {
      click: function (px) { to(px < x + w / 3 ? index - 1 : index + 1); },
      drag: function (dy) { to(index - Math.round(dy / 8)); }
    });
  }

  function toggle(label, on, x, y, w, h, onChange) {
    round(x, y, w, h, 3, on ? C.accent : C.control);
    text(label, x + 4, y, w - 8, h, C.ink, 10, 1, true);
    hit(x, y, w, h, { click: function () { onChange(!on); } });
  }

  // Mouse, as [v8ui] delivers it: onclick then ondrag until the button is up.
  function click(px, py) {
    var r = find(px, py);
    drag = null;
    if (!r) return false;
    if (r.fn.drag) drag = { r: r, y0: py, moved: false };
    else if (r.fn.click) r.fn.click(px, py);
    return true;
  }
  function dragTo(px, py, down) {
    if (!drag) return;
    var dy = drag.y0 - py;
    if (down) {
      if (Math.abs(dy) >= 4) drag.moved = true;
      if (drag.moved) drag.r.fn.drag(dy);
    } else {
      if (!drag.moved && drag.r.fn.click) drag.r.fn.click(px, py);
      drag = null;
    }
  }

  return { C: C, begin: begin, rect: rect, round: round, frame: frame, text: text, fit: fit, measure: measure,
           hit: hit, button: button, stepper: stepper, toggle: toggle, click: click, dragTo: dragTo, find: find };
})();


/* ---- kit/live.js ---- */
/* The Live set, as the family's devices need it: the song's tempo, meter and
 * scale, the notes of the clip being edited, somewhere to put new notes, and
 * a way to hear notes before they are used.
 *
 * Everything goes through the Live Object Model (LiveAPI). Times are beats,
 * which in Live are quarter notes - the unit every family engine already
 * speaks - so nothing is converted but the field names.
 */
var Live = (function () {
  'use strict';
  function api(path) { return new LiveAPI(null, path); }
  function one(a, prop) { var v = a.get(prop); return Array.isArray(v) ? v[0] : v; }
  function exists(a) { return a && Number(a.id) !== 0; }
  function json(v) {
    if (typeof v === 'string') return JSON.parse(v);
    if (Array.isArray(v) && typeof v[0] === 'string' && v.length === 1) return JSON.parse(v[0]);
    return v;
  }

  // Live 12's scale names, as ScaleView numbers its scales (1-16). A scale
  // ScaleView has no name for is left out: the device keeps its own key.
  var SCALE = {
    'Major': 1, 'Minor': 2, 'Harmonic Minor': 3, 'Dorian': 5, 'Phrygian': 6, 'Lydian': 7,
    'Mixolydian': 8, 'Major Pentatonic': 10, 'Minor Pentatonic': 11, 'Minor Blues': 13,
    'Whole Tone': 14, 'Whole-half Dim.': 15, 'Half-whole Dim.': 16
  };
  // ScaleView's eighteen roots, and the spelling a key on each pitch class
  // takes: flats for the major side, sharps where a minor key has them.
  var ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B', 'Cb'];
  var MAJOR_SIDE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  var MINOR_SIDE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
  var MINORISH = { 2: 1, 3: 1, 5: 1, 6: 1, 11: 1, 13: 1 };
  var SCALE_NAMES = ['Major', 'Minor (Natural)', 'Harmonic Minor', 'Ionian', 'Dorian', 'Phrygian', 'Lydian',
                     'Mixolydian', 'Aeolian', 'Major Pentatonic', 'Minor Pentatonic', 'Major Blues', 'Minor Blues',
                     'Whole Tone', 'Diminished Whole-Half', 'Diminished Half-Whole'];

  function song() {
    var s = api('live_set');
    var out = { tempo: +one(s, 'tempo') || 120, num: +one(s, 'signature_numerator') || 4,
                den: +one(s, 'signature_denominator') || 4, playing: !!+one(s, 'is_playing'),
                position: +one(s, 'current_song_time') || 0, key: null };
    var mode = s.get('scale_mode');
    if (mode !== undefined && mode !== null) {
      var name = String(one(s, 'scale_name')), pc = +one(s, 'root_note');
      var sc = SCALE[name];
      out.liveScale = { on: !!+(Array.isArray(mode) ? mode[0] : mode), name: name, root: pc };
      if (sc) out.key = { root: ROOTS.indexOf((MINORISH[sc] ? MINOR_SIDE : MAJOR_SIDE)[((pc % 12) + 12) % 12]) + 1, scale: sc };
    }
    return out;
  }

  function detailClip() {
    var c = api('live_set view detail_clip');
    if (!exists(c) || !+one(c, 'is_midi_clip')) return null;
    return c;
  }

  // The clip being edited: its selected notes if any are selected, else every
  // note in its loop. Starts are from the start of what was taken.
  function clipNotes() {
    var c = detailClip();
    if (!c) return null;
    var from = +one(c, 'loop_start') || 0, to = +one(c, 'loop_end') || 0;
    var raw = null, selected = false;
    try { raw = json(c.call('get_selected_notes_extended')); selected = raw && raw.notes && raw.notes.length > 0; } catch (e) { raw = null; }
    if (!selected) raw = json(c.call('get_notes_extended', 0, 128, from, Math.max(0, to - from)));
    var notes = ((raw && raw.notes) || []).filter(function (n) { return !n.mute; }).map(function (n) {
      return { start: n.start_time, len: n.duration, pitch: n.pitch, vel: Math.round(n.velocity) };
    });
    var first = selected && notes.length ? Math.min.apply(null, notes.map(function (n) { return n.start; })) : from;
    var beats = to - from;
    if (selected) {
      var bar = 4, end = 0;
      notes.forEach(function (n) { end = Math.max(end, n.start + n.len); });
      first = Math.floor(first / bar) * bar;
      beats = Math.ceil((end - first) / bar) * bar;
    }
    notes.forEach(function (n) { n.start -= first; });
    notes.sort(function (a, b) { return a.start - b.start || a.pitch - b.pitch; });
    return { notes: notes, beats: beats, name: String(one(c, 'name') || ''), selected: selected, drums: drumTrack() };
  }

  // A track whose instrument is a Drum Rack plays drums: its note numbers name
  // drums, not pitches, and the engines treat them that way.
  function drumTrack() {
    try {
      var track = api('this_device canonical_parent'), n = track.getcount('devices');
      for (var i = 0; i < n; i++) if (+one(api(track.unquotedpath + ' devices ' + i), 'can_have_drum_pads')) return true;
    } catch (e) { /* not known: not drums */ }
    return false;
  }

  function liveNotes(notes) {
    return { notes: notes.map(function (n) {
      return { pitch: Math.max(0, Math.min(127, Math.round(n.pitch))), start_time: Math.max(0, n.start),
               duration: Math.max(1 / 128, n.len), velocity: Math.max(1, Math.min(127, Math.round(n.vel || 100))), mute: 0 };
    }) };
  }

  function undoable(fn) {
    var s = api('live_set');
    try { s.call('begin_undo_step'); } catch (e) { /* Live before 11.1 */ }
    try { return fn(); } finally { try { s.call('end_undo_step'); } catch (e2) { /* as above */ } }
  }

  function show(clip) {
    try { api('live_set view').set('detail_clip', 'id', Number(clip.id)); } catch (e) { /* the clip is made either way */ }
  }

  function selectedScene() {
    var scene = api('live_set view selected_scene'), n = api('live_set').getcount('scenes');
    for (var i = 0; i < n; i++) if (Number(api('live_set scenes ' + i).id) === Number(scene.id)) return i;
    return 0;
  }
  function thisTrack() {
    var track = api('this_device canonical_parent');
    if (!exists(track) || !+one(track, 'has_midi_input')) return null;
    return track;
  }
  // Where this device's track is in the set, for putting new tracks beside it.
  function trackIndex(track) {
    var n = api('live_set').getcount('tracks');
    for (var i = 0; i < n; i++) if (Number(api('live_set tracks ' + i).id) === Number(track.id)) return i;
    return n - 1;
  }
  function clipInSlot(slot, notes, beats, name) {
    slot.call('create_clip', Math.max(1, beats));
    var clip = api(slot.unquotedpath + ' clip');
    if (name) clip.set('name', name);
    clip.call('add_new_notes', liveNotes(notes));
    return clip;
  }
  function freeSlot(track, from) {
    var n = track.getcount('clip_slots');
    for (var k = 0; k < n; k++) {
      var at = (from + k) % n, slot = api(track.unquotedpath + ' clip_slots ' + at);
      if (!+one(slot, 'has_clip')) return { slot: slot, at: at };
    }
    return null;
  }
  function arrangementClipOn(track, notes, beats, name, at) {
    var before = track.getcount('arrangement_clips');
    try { track.call('create_midi_clip', at, Math.max(1, beats)); } catch (e) { /* checked below */ }
    var count = track.getcount('arrangement_clips');
    if (!(count > before)) return false;
    for (var i = 0; i < count; i++) {
      var clip = api(track.unquotedpath + ' arrangement_clips ' + i);
      if (Math.abs((+one(clip, 'start_time') || 0) - at) < 1e-6) {
        if (name) clip.set('name', name);
        clip.call('add_new_notes', liveNotes(notes));
        return true;
      }
    }
    return false;
  }

  // New notes, as a new clip in the first free slot on this device's track,
  // from the selected scene down. `more` are further parts ({name, notes}),
  // each on a new MIDI track after this one, in the same scene. Returns what
  // happened, for the status line.
  function newClip(notes, beats, name, more) {
    var track = thisTrack();
    if (!track) return { ok: false, message: 'This device needs to be on a MIDI track.' };
    var free = freeSlot(track, selectedScene());
    if (!free) return { ok: false, message: 'Every clip slot on this track is full. Add a scene, then try again.' };
    return undoable(function () {
      var clip = clipInSlot(free.slot, notes, beats, name);
      var made = newTracks(track, more, function (t) {
        clipInSlot(api(t.unquotedpath + ' clip_slots ' + free.at), this.notes, beats, this.name);
      });
      show(clip);
      return { ok: true, message: 'Added a clip in scene ' + (free.at + 1) + (made ? ', and ' + made + ' on new tracks beside it.' : '.') };
    });
  }

  // New notes on a new MIDI track beside this one, in the selected scene:
  // a suggestion goes with the music it was made for, not over it.
  function newTrackClip(notes, beats, name, more) {
    var track = thisTrack();
    if (!track) return { ok: false, message: 'This device needs to be on a MIDI track.' };
    var scene = selectedScene();
    return undoable(function () {
      var parts = [{ name: name, notes: notes }].concat(more || []);
      newTracks(track, parts, function (t) { show(clipInSlot(api(t.unquotedpath + ' clip_slots ' + scene), this.notes, beats, this.name)); });
      return { ok: true, message: parts.length === 1 ? 'Added a track beside this one, with the clip in scene ' + (scene + 1) + '.'
                                                     : 'Added ' + parts.length + ' tracks beside this one, with the clips in scene ' + (scene + 1) + '.' };
    });
  }

  // Each further part on a new MIDI track, in order, after this one.
  function newTracks(track, more, put) {
    if (!more || !more.length) return '';
    var at = trackIndex(track), song = api('live_set');
    more.forEach(function (part, k) {
      song.call('create_midi_track', at + 1 + k);
      var t = api('live_set tracks ' + (at + 1 + k));
      t.set('name', part.name);
      put.call(part, t);
    });
    return more.length === 1 ? 'one more part' : more.length + ' more parts';
  }

  // New notes in place of the notes of the clip being edited, from its loop start.
  function replaceInClip(notes, beats) {
    var c = detailClip();
    if (!c) return { ok: false, message: 'No MIDI clip is open. Open one in Detail View, then try again.' };
    var from = +one(c, 'loop_start') || 0;
    return undoable(function () {
      var span = Math.max(beats, (+one(c, 'loop_end') || 0) - from);
      c.call('remove_notes_extended', 0, 128, from, span);
      c.call('add_new_notes', liveNotes(notes.map(function (n) {
        return { start: n.start + from, len: n.len, pitch: n.pitch, vel: n.vel };
      })));
      if ((+one(c, 'loop_end') || 0) < from + beats) c.set('loop_end', from + beats);
      return { ok: true, message: 'Replaced the notes in “' + (String(one(c, 'name') || '') || 'the clip') + '”.' };
    });
  }

  // New notes in the Arrangement at the insert marker, on this device's track
  // (Track.create_midi_clip, Live 12.2 and later); further parts as above.
  function arrangementClip(notes, beats, name, more) {
    var track = thisTrack();
    if (!track) return { ok: false, message: 'This device needs to be on a MIDI track.' };
    var at = +one(api('live_set'), 'current_song_time') || 0;
    return undoable(function () {
      if (!arrangementClipOn(track, notes, beats, name, at)) {
        return { ok: false, message: 'This version of Live can\u2019t add Arrangement clips from a device. Choose New Clip instead.' };
      }
      var made = newTracks(track, more, function (t) { arrangementClipOn(t, this.notes, beats, this.name, at); });
      return { ok: true, message: 'Added a clip to the Arrangement at beat ' + (Math.round(at * 100) / 100 + 1) +
               (made ? ', and ' + made + ' on new tracks beside it.' : '.') };
    });
  }

  // ------------------------------------------------------------ player ---
  // Notes heard through this device's MIDI out: the instrument after it on
  // the track plays them. A Task ticks every few milliseconds and sends what
  // is due; nothing waits on the transport.
  function Player(send) {
    this.send = send; this.events = []; this.pos = 0; this.t0 = 0; this.task = null; this.sounding = {};
    this.onEnd = null;
  }
  Player.prototype.play = function (notes, tempo, onEnd) {
    this.stop();
    var ms = 60000 / (tempo || 120), ev = [];
    notes.forEach(function (n) {
      ev.push({ t: n.start * ms, on: true, pitch: n.pitch, vel: n.vel || 100 });
      ev.push({ t: (n.start + n.len) * ms - 1, on: false, pitch: n.pitch });
    });
    ev.sort(function (a, b) { return a.t - b.t || (a.on === b.on ? 0 : a.on ? 1 : -1); });
    this.events = ev; this.pos = 0; this.t0 = Date.now(); this.onEnd = onEnd || null;
    var self = this;
    this.task = new Task(function () { self.tick(); }, this);
    this.task.interval = 4;
    this.task.repeat();
    this.tick();
  };
  Player.prototype.tick = function () {
    var now = Date.now() - this.t0;
    while (this.pos < this.events.length && this.events[this.pos].t <= now) {
      var e = this.events[this.pos++];
      if (e.on) { this.sounding[e.pitch] = (this.sounding[e.pitch] || 0) + 1; this.send([0x90, e.pitch, Math.max(1, Math.min(127, Math.round(e.vel)))]); }
      else if (this.sounding[e.pitch]) { this.sounding[e.pitch]--; this.send([0x80, e.pitch, 0]); }
    }
    if (this.pos >= this.events.length) {
      var end = this.onEnd;
      this.stop();
      if (end) end();
    }
  };
  Player.prototype.playing = function () { return !!this.task; };
  Player.prototype.stop = function () {
    if (this.task) { this.task.cancel(); this.task.freepeer && this.task.freepeer(); this.task = null; }
    var self = this;
    Object.keys(this.sounding).forEach(function (p) {
      for (var i = 0; i < self.sounding[p]; i++) self.send([0x80, +p, 0]);
    });
    this.sounding = {};
    this.onEnd = null;
  };

  return { song: song, clipNotes: clipNotes, newClip: newClip, newTrackClip: newTrackClip, replaceInClip: replaceInClip,
           arrangementClip: arrangementClip, drumTrack: drumTrack, Player: Player, ROOTS: ROOTS, SCALE_NAMES: SCALE_NAMES };
})();


/* ---- kit/generator.js ---- */
/* A family generator as a Max for Live MIDI effect.
 *
 * The engine is the repository's own Lua, run unchanged by Middaw's Lua
 * runtime; the adapter (Noterator's) turns its settings into lists and its
 * output into notes. This file is only the window: the key, the engine's
 * settings, the results, and Play and Insert.
 *
 * Expects, before it: UI, Live, MiddawHost, and DEVICE = { generator, files }.
 * Outlets: 0 MIDI bytes to [midiout], 1 the saved state to [pattr].
 */
inlets = 1;
outlets = 2;
mgraphics.init();
mgraphics.relative_coords = 0;
mgraphics.autofill = 0;

var H = MiddawHost;
H.init(function (p) { return DEVICE.files[p] === undefined ? null : DEVICE.files[p]; },
       function (s) { post(s + '\n'); });

function call(method, args) {
  var r = JSON.parse(H.call(method, args === undefined ? '' : JSON.stringify(args)));
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

var GEN = null;
call('generators').forEach(function (g) { if (g.id === DEVICE.generator) GEN = g; });

var S = {
  session: call('newSession', { generator: DEVICE.generator }),
  key: { root: 1, scale: 1 }, follow: true, seed: 1, target: 0,
  song: { tempo: 120, num: 4, den: 4 },
  settings: [], results: [], chosen: 0, part: 0, inst: 'pno', page: 0, scroll: 0,
  selection: null, status: '', warn: false, ready: false, pending: null
};
// Where Insert puts a result. A suggestion (DEVICE.beside) goes with the
// music it was made for, so its first choice is a track of its own.
var TARGETS = DEVICE.beside ? ['New Track', 'New Clip', 'Arrangement', 'This Clip'] : ['New Clip', 'Arrangement', 'This Clip'];
var player = new Live.Player(function (bytes) { for (var i = 0; i < bytes.length; i++) outlet(0, bytes[i]); });

function say(msg, warn) { S.status = msg || ''; S.warn = !!warn; }

function context() {
  var sel = S.selection || { notes: [], beats: 0, drums: false };
  return { root: S.key.root, scale: S.key.scale, num: S.song.num, den: S.song.den,
           barBeats: S.song.num * 4 / S.song.den, bpm: S.song.tempo, inst: S.inst, catalogueId: S.inst, bars: 4,
           selection: { notes: sel.notes, beats: sel.beats, drums: !!sel.drums } };
}

// A result with more than one part (melody, chords, bass, drums) offers a
// Part setting of the device's own: all of them, or one.
function partNames() {
  var most = [];
  S.results.forEach(function (r) { if (r.parts.length > most.length) most = r.parts; });
  return most.length > 1 ? ['All Parts'].concat(most.map(function (p, i) { return p.name || ('Part ' + (i + 1)); })) : null;
}
// The device's Key and Scale are the engine's key; an engine that also lists
// its own is not shown it twice.
var OWN_KEY = { root: 1, scale: 1, key: 1 };
// An engine written for one instrument (DEVICE.instrument) is told which:
// Midi Catalogue's orchestra, chosen on the device, as Noterator's part is.
var EXTRA = { asax: 1, tsax: 1, bsax: 1, vib: 1, sop: 1, alto: 1, ten: 1, bass: 1, gtr: 1, ebass: 1, ubass: 1, synth: 1, kit: 1 };
var INSTRUMENTS = DEVICE.instrument ? call('instruments').filter(function (i) { return !EXTRA[i.id]; }) : [];
function refreshSettings() {
  S.settings = call('settings', { session: S.session, context: context() }).filter(function (s) { return !OWN_KEY[s.id]; });
  if (INSTRUMENTS.length) {
    var at = 0;
    INSTRUMENTS.forEach(function (x, i) { if (x.id === S.inst) at = i; });
    S.settings.unshift({ id: '$inst', label: 'Instrument', names: INSTRUMENTS.map(function (x) { return x.name; }), index: at + 1, hint: '' });
  }
  var parts = partNames();
  if (parts) {
    if (S.part >= parts.length) S.part = 0;
    S.settings.push({ id: '$part', label: 'Part', names: parts, index: S.part + 1, hint: '' });
  }
}

function generate() {
  if (GEN.input === 'selection' && !S.selection) {
    S.results = [];
    refreshSettings();
    say('Open a MIDI clip in Detail View, then click Use Clip.');
    return;
  }
  try {
    var r = call('generate', { session: S.session, context: context(), seed: S.seed, count: 8 });
    S.results = r.results || [];
    if (S.chosen >= S.results.length) S.chosen = 0;
    refreshSettings();
    if (r.message) say(r.message);
    else if (!S.results.length) say('Nothing fits these settings. Change one, then try again.');
  } catch (e) {
    S.results = [];
    say(String(e.message || e), true);
  }
}

function save() {
  outlet(1, 'set', JSON.stringify({ v: 1, st: call('snapshot', { session: S.session }), key: S.key,
                                    follow: S.follow, seed: S.seed, target: S.target, part: S.part, inst: S.inst }));
}

function useKey() { call('useKey', { session: S.session, key: S.key }); }

function readSong() {
  try {
    var s = Live.song();
    S.song = { tempo: s.tempo, num: s.num, den: s.den };
    if (S.follow && s.liveScale && s.liveScale.on) {
      if (s.key) { S.key = s.key; return true; }
      say('Live’s scale, ' + s.liveScale.name + ', isn’t one this device knows, so it stays in ' + keyName() + '.');
    }
  } catch (e) { /* not in Live: keep what we have */ }
  return false;
}

function keyName() { return Live.ROOTS[S.key.root - 1] + ' ' + Live.SCALE_NAMES[S.key.scale - 1]; }

// ------------------------------------------------------------ messages --
// [live.thisdevice] bangs once Live is ready to be spoken to.
function bang() {
  S.ready = true;
  if (S.pending) { apply(S.pending); S.pending = null; }
  readSong();
  useKey();
  generate();
  mgraphics.redraw();
}

// The state [pattr] kept with the Live set.
function restore(text) {
  var st = null;
  try { st = JSON.parse(String(text)); } catch (e) { return; }
  if (!S.ready) { S.pending = st; return; }
  apply(st);
  generate();
  mgraphics.redraw();
}
function apply(st) {
  if (!st || st.v !== 1) return;
  if (st.st) call('restore', { session: S.session, state: st.st });
  if (st.key) S.key = st.key;
  S.follow = st.follow !== false;
  S.seed = st.seed || 1;
  S.target = st.target || 0;
  S.part = st.part || 0;
  if (st.inst) S.inst = st.inst;
  useKey();
}

// ------------------------------------------------------------- actions --
function setSetting(id, index) {
  if (id === '$part') { S.part = index - 1; refreshSettings(); save(); mgraphics.redraw(); return; }
  if (id === '$inst') { S.inst = INSTRUMENTS[index - 1].id; say(''); generate(); save(); mgraphics.redraw(); return; }
  call('set', { session: S.session, setting: id, index: index, context: context() });
  say('');
  generate();
  save();
  mgraphics.redraw();
}
function setKey(root, scale) {
  S.key = { root: root, scale: scale };
  S.follow = false;
  useKey();
  say('');
  generate();
  save();
  mgraphics.redraw();
}
function newIdeas() {
  S.seed = 1 + Math.floor(Math.random() * 99999);
  S.chosen = 0; S.scroll = 0;
  say('');
  readSong();
  useKey();
  generate();
  save();
  mgraphics.redraw();
}
// The chosen result as notes: every part together for hearing, and for
// inserting the first part here and `more` on tracks of their own.
function chosenNotes() {
  var r = S.results[S.chosen];
  if (!r) return null;
  var parts = S.part > 0 && r.parts[S.part - 1] ? [r.parts[S.part - 1]] : r.parts;
  var all = [];
  parts.forEach(function (p) { p.notes.forEach(function (n) { all.push(n); }); });
  all.sort(function (a, b) { return a.start - b.start || a.pitch - b.pitch; });
  var title = r.title || GEN.name;
  function named(p) { return parts.length > 1 && p.name ? title + ' \u2014 ' + p.name : title; }
  return { all: all, notes: parts[0] ? parts[0].notes : [], beats: r.beats || 4, title: named(parts[0] || {}),
           more: parts.slice(1).map(function (p) { return { name: named(p), notes: p.notes }; }) };
}
function play() {
  if (player.playing()) { player.stop(); mgraphics.redraw(); return; }
  var c = chosenNotes();
  if (!c) return;
  readSong();
  player.play(heard(c), S.song.tempo, function () { mgraphics.redraw(); });
  mgraphics.redraw();
}
// What Play sounds: the result, and for a suggestion the music it goes with.
function heard(c) {
  if (!DEVICE.beside || !S.selection) return c.all;
  return c.all.concat(S.selection.notes).sort(function (a, b) { return a.start - b.start || a.pitch - b.pitch; });
}
function insert() {
  var c = chosenNotes();
  if (!c) return;
  player.stop();
  var r;
  try {
    var beats = Math.max(c.beats, Math.ceil(c.beats));
    var where = TARGETS[S.target];
    r = where === 'New Track' ? Live.newTrackClip(c.notes, beats, c.title, c.more)
      : where === 'New Clip' ? Live.newClip(c.notes, beats, c.title, c.more)
      : where === 'Arrangement' ? Live.arrangementClip(c.notes, beats, c.title, c.more)
      : c.more.length ? { ok: false, message: 'This Clip takes one part. Choose a part, then try again.' }
      : Live.replaceInClip(c.notes, beats);
  } catch (e) { r = { ok: false, message: String(e.message || e) }; }
  say(r.message, !r.ok);
  mgraphics.redraw();
}
function useClip() {
  var c = null;
  try { c = Live.clipNotes(); } catch (e) { c = null; }
  if (!c) { say('No MIDI clip is open. Open one in Detail View, then try again.', true); mgraphics.redraw(); return; }
  if (!c.notes.length) { say('That clip has no notes. Choose a clip with notes, then try again.', true); mgraphics.redraw(); return; }
  S.selection = { notes: c.notes, beats: Math.max(1, c.beats), name: c.name, drums: c.drums };
  say('Using ' + c.notes.length + (c.selected ? ' selected' : '') + ' notes from “' + (c.name || 'the clip') + '”.');
  readSong();
  generate();
  mgraphics.redraw();
}
function choose(i) {
  S.chosen = i;
  player.stop();
  var c = chosenNotes();
  if (c) player.play(heard(c), S.song.tempo, function () { mgraphics.redraw(); });
  mgraphics.redraw();
}

// --------------------------------------------------------------- paint --
var KEY_X = 6, KEY_W = 104, SET_X = 118, CELL_W = 104, CELL_GAP = 6, ROW_Y = [20, 54, 88, 122];

function size() {
  var r = (typeof box !== 'undefined' && box.rect) ? box.rect : [0, 0, 860, 169];
  return [r[2] - r[0], r[3] - r[1]];
}

function paint() {
  var g = mgraphics, sz = size(), W = sz[0], Ht = sz[1];
  UI.begin(g);
  UI.rect(0, 0, W, Ht, UI.C.ground);
  UI.text(S.status || ((DEVICE.title || GEN.name) + (DEVICE.keyless ? '' : ' — ' + keyName())), 6, 1, W - 12, 16, S.warn ? UI.C.warnText : UI.C.dim, 10, 0);

  // The key: the engine writes in it, and follows Live's scale when asked.
  // An engine that hears the key in the music it is given has no key to set.
  if (!DEVICE.keyless) {
  UI.stepper('Key', Live.ROOTS, S.key.root, KEY_X, ROW_Y[0], KEY_W, function (i) { setKey(i, S.key.scale); });
  UI.stepper('Scale', Live.SCALE_NAMES, S.key.scale, KEY_X, ROW_Y[1], KEY_W, function (i) { setKey(S.key.root, i); });
  UI.toggle('Follow Live', S.follow, KEY_X, ROW_Y[2] + 13, KEY_W, 18, function (on) {
    S.follow = on;
    if (on) { readSong(); useKey(); generate(); }
    save(); mgraphics.redraw();
  });
  }
  if (GEN.input === 'selection') UI.button('Use Clip', KEY_X, DEVICE.keyless ? ROW_Y[0] + 13 : ROW_Y[3] + 13, KEY_W, 18, !!S.selection, useClip);

  // A block read as notation (DEVICE.notation): Starting Blocks Notation's
  // engraving of the chosen result, at the right.
  var noteW = DEVICE.notation ? 380 : 0;
  if (noteW) drawScore(W - noteW, 18, noteW - 6, Ht - 22);

  // The engine's settings, four rows to a column.
  var resX = W - 296 - noteW, cols = Math.max(1, Math.floor((resX - SET_X) / (CELL_W + CELL_GAP))), per = cols * 4;
  var pages = Math.max(1, Math.ceil(S.settings.length / per));
  if (S.page >= pages) S.page = 0;
  var shown = S.settings.slice(S.page * per, (S.page + 1) * per);
  shown.forEach(function (s, i) {
    var col = Math.floor(i / 4), row = i % 4;
    UI.stepper(s.label, s.names, s.index, SET_X + col * (CELL_W + CELL_GAP), ROW_Y[row], CELL_W, function (k) { setSetting(s.id, k); });
  });
  // More than a page of settings: the next page from the foot of the key
  // column, which is free (Use Clip sits at its top when there is no key).
  if (pages > 1 && !(GEN.input === 'selection' && !DEVICE.keyless)) {
    UI.button('More Settings', KEY_X, ROW_Y[3] + 13, KEY_W, 18, false, function () { S.page = (S.page + 1) % pages; mgraphics.redraw(); });
    UI.text('Page ' + (S.page + 1) + ' of ' + pages, KEY_X, ROW_Y[3] + 32, KEY_W, 14, UI.C.dim, 9, 1);
  }

  // The results: click one to hear it.
  // Eight rows, or seven and the arrows in the eighth's place when there are more.
  var lx = resX, lw = 290, ly = 20, rowH = 15, rows = S.results.length > 8 ? 7 : 8;
  UI.rect(lx, ly, lw, 8 * rowH + 2, UI.C.sunken);
  if (S.chosen < S.scroll) S.scroll = S.chosen;
  if (S.chosen >= S.scroll + rows) S.scroll = S.chosen - rows + 1;
  for (var i = 0; i < rows && S.scroll + i < S.results.length; i++) {
    var k = S.scroll + i, r = S.results[k], y = ly + 1 + i * rowH, on = k === S.chosen;
    if (on) { UI.rect(lx, y, lw, rowH, UI.C.raised); UI.rect(lx, y, 3, rowH, UI.C.accent); }
    UI.text(r.title || ('Result ' + (k + 1)), lx + 8, y, lw * 0.6 - 10, rowH, on ? UI.C.text : UI.C.label, 10, 0, on);
    UI.text(r.detail || '', lx + lw * 0.6, y, lw * 0.4 - 6, rowH, UI.C.dim, 9, 2);
    (function (index) { UI.hit(lx, y, lw, rowH, { click: function () { choose(index); } }); })(k);
  }
  if (S.results.length > rows) {
    UI.button('↑', lx + lw - 38, ly + rows * rowH + 2, 18, 13, false, function () { S.chosen = Math.max(0, S.chosen - 1); mgraphics.redraw(); });
    UI.button('↓', lx + lw - 18, ly + rows * rowH + 2, 18, 13, false, function () { S.chosen = Math.min(S.results.length - 1, S.chosen + 1); mgraphics.redraw(); });
  }

  var by = Ht - 22, has = S.results.length > 0;
  UI.button('New Ideas', lx, by, 76, 18, false, newIdeas);
  UI.button(player.playing() ? 'Stop' : 'Play', lx + 80, by, 46, 18, player.playing(), play, has);
  UI.button('Insert', lx + 130, by, 56, 18, false, insert, has);
  UI.button(TARGETS[S.target], lx + 190, by, 100, 18, false, function () { S.target = (S.target + 1) % TARGETS.length; save(); mgraphics.redraw(); });
}

// --------------------------------------------------------------- score --
var score = { key: null, ops: null, height: 0 };
function engraving() {
  var r = S.results[S.chosen];
  if (!r) return null;
  var k = JSON.stringify([S.chosen, r.title, r.beats, S.key, r.parts[0] && r.parts[0].notes.length]);
  if (score.key === k) return score;
  try {
    var e = call('engrave', { key: S.key, barBeats: S.song.num * 4 / S.song.den, meter: [S.song.num, S.song.den], width: 360,
                              notes: chosenNotes().all, beats: r.beats || 4, name: '', drums: false, space: 6 });
    score = { key: k, ops: e.ops, height: e.height };
  } catch (err) { score = { key: k, ops: [], height: 0, error: String(err.message || err) }; }
  return score;
}
// The pen's colours: 1 ink, 2 staff, 3 ground, 4 accent, in the house palette.
function penColour(c) { return c === 2 ? UI.C.dim : c === 3 ? UI.C.sunken : c === 4 ? UI.C.accent : UI.C.text; }
// How wide the engraving really is, so a short block is drawn large.
function scoreWidth(ops) {
  var m = 1;
  ops.forEach(function (op) {
    if (op[0] === 'line') m = Math.max(m, op[1], op[3]);
    else if (op[0] === 'poly') for (var i = 0; i < op[1].length; i += 2) m = Math.max(m, op[1][i]);
    else m = Math.max(m, op[1]);
  });
  return m;
}
function drawScore(x, y, w, h) {
  var g = mgraphics, sc = engraving();
  UI.rect(x, y, w, h, UI.C.sunken);
  if (!sc || !sc.ops || !sc.ops.length) return;
  var z = Math.min(2, (h - 8) / Math.max(1, sc.height), (w - 16) / scoreWidth(sc.ops));
  var ox = x + 4, oy = y + 4 + Math.max(0, (h - 8 - sc.height * z) / 2);
  sc.ops.forEach(function (op) {
    var col = penColour(op[op[0] === 'line' ? 5 : op[0] === 'poly' ? 2 : op[0] === 'circle' ? 4 : 3]);
    g.set_source_rgba(col[0], col[1], col[2], col[3]);
    if (op[0] === 'line') {
      g.set_line_width(Math.max(0.5, op[6] * z));
      g.move_to(ox + op[1] * z, oy + op[2] * z); g.line_to(ox + op[3] * z, oy + op[4] * z); g.stroke();
    } else if (op[0] === 'poly') {
      var p = op[1];
      g.move_to(ox + p[0] * z, oy + p[1] * z);
      for (var i = 2; i + 1 < p.length; i += 2) g.line_to(ox + p[i] * z, oy + p[i + 1] * z);
      g.close_path(); g.fill();
    } else if (op[0] === 'circle') {
      g.arc(ox + op[1] * z, oy + op[2] * z, op[3] * z, 0, Math.PI * 2);
      if (op[5]) g.fill(); else { g.set_line_width(1); g.stroke(); }
    } else if (op[0] === 'text') {
      g.select_font_face('Arial', 'normal', 'normal'); g.set_font_size(Math.max(6, op[5] * z));
      var tw = op[6] ? g.text_measure(op[4])[0] : 0;
      g.move_to(ox + op[1] * z - tw / 2, oy + op[2] * z); g.show_text(op[4]);
    }
  });
}

function onclick(x, y) { if (UI.click(x, y)) mgraphics.redraw(); }
function ondrag(x, y, but) { UI.dragTo(x, y, !!but); }

