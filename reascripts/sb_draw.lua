--[[
 * sb_draw.lua - puts ink on what sb_notate.lua laid out.
 *
 * No `reaper.` and no `ImGui.` in this file either. It draws through a pen -
 * four calls, `line`, `poly`, `circle` and `text` - and the window hands it
 * one backed by a ReaImGui draw list. A test hands it one that writes down
 * what it was asked for, which is the only way an assertion about a stem or a
 * ledger line can exist at all.
 *
 * Everything here is in staff spaces until the last moment: a space is the
 * unit music is engraved in, every distance below is a fraction of one, and
 * `space` in pixels is the single number that scales the page.
 *
 * The symbols are Bravura's - clefs, heads, flags, rests, accidentals,
 * figures - baked into `sb_glyphs.lua` as polygons by `tools/bake_glyphs.py`
 * (0013). No font is loaded and none has to be installed: a REAPER user has
 * no reason to have one, and an app that looks wrong on someone else's
 * machine is worse than one that carries its own ink (0004). The lines -
 * staff, stems, beams, ledgers, bar lines, ties - are drawn here, to
 * Bravura's own engraving defaults.
--]]

local D = {}

local N = nil
function D.setNotate(n) N = n end

local G = nil
function D.setGlyphs(g) G = g end

------------------------------------------------------------------------------
-- Proportions
------------------------------------------------------------------------------

-- All of these are in staff spaces, and all of them are Bravura's published
-- engraving defaults rather than numbers tuned by eye, so the lines are
-- weighted the way the font's symbols were drawn to sit among.
-- The head's width is `N.HEAD_RX`, not a constant here: the layout needs the
-- same number to work out where the accidental in front of a head goes, and
-- two copies of it would be two copies to keep in step.
local STAFF_TH    = 0.13
local LEDGER_TH   = 0.16
local LEDGER_EXT  = 0.40      -- past each side of the head
local STEM_TH     = 0.12
local STEM_LEN    = 3.5
local BEAM_TH     = 0.50
local BEAM_GAP    = 0.25
local BAR_TH      = 0.16
local THICK_BAR   = 0.50
local BAR_SEP     = 0.40
local TIE_MID     = 0.22      -- how thick a tie is at its middle
local TUPLET_TH   = 0.16
local DOT_R       = 0.20

------------------------------------------------------------------------------
-- Shapes
------------------------------------------------------------------------------

local function bezier(pts, x1, y1, cx1, cy1, cx2, cy2, x2, y2, steps)
  steps = steps or 14
  for i = 0, steps do
    local t = i / steps
    local u = 1 - t
    local a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
    pts[#pts + 1] = a * x1 + b * cx1 + c * cx2 + d * x2
    pts[#pts + 1] = a * y1 + b * cy1 + c * cy2 + d * y2
  end
end

-- A filled shape, turned clockwise on the screen first. ReaImGui smooths a
-- fill's edge by pushing a soft fringe out along each edge, and it decides
-- which way is out from the winding: wound the other way, the fringe eats
-- into the shape instead and a beam comes out thin and furry.
local function fill(pen, pts, col)
  local a, n = 0, #pts
  for i = 1, n - 1, 2 do
    local j = (i + 2 > n) and 1 or i + 2
    a = a + pts[i] * pts[j + 1] - pts[j] * pts[i + 1]
  end
  if a < 0 then
    local r = {}
    for i = n - 1, 1, -2 do r[#r + 1] = pts[i]; r[#r + 1] = pts[i + 1] end
    pts = r
  end
  pen.poly(pts, col)
end

local function glyphOf(name)
  local g = G and G[name]
  if not g then
    error(G and ("no glyph called " .. tostring(name))
            or "sb_draw.lua was not handed its glyphs: call D.setGlyphs", 3)
  end
  return g
end

-- Puts one of Bravura's symbols on the page with its SMuFL origin at (x, y).
-- The polygons were baked clockwise and a positive scale keeps them that way,
-- so they go straight to the pen. `sx` and `sy` stretch it, which only the
-- brace and the tuplet's figure need.
local function rings(pen, list, x, y, sp, col, sx, sy)
  local kx, ky = (sx or 1) * sp, (sy or 1) * sp
  for _, ring in ipairs(list) do
    local pts = {}
    for i = 1, #ring - 1, 2 do
      pts[i]     = x + ring[i] * kx
      pts[i + 1] = y + ring[i + 1] * ky
    end
    pen.poly(pts, col)
  end
end

local function glyph(pen, name, x, y, sp, col, sx, sy)
  rings(pen, glyphOf(name).fill, x, y, sp, col, sx, sy)
end

-- The same, centred across x rather than starting at it: a notehead, a rest
-- and an accidental are placed by their middles in the layout.
local function centred(pen, name, x, y, sp, col)
  local g = glyphOf(name)
  glyph(pen, name, x - (g.x1 + g.x2) / 2 * sp, y, sp, col)
end

------------------------------------------------------------------------------
-- The page frame
------------------------------------------------------------------------------

-- A staff's geometry. `top` is the y of its top line; a position is in
-- half-spaces above the bottom line, so a line is an even number and a space
-- an odd one.
local function staffAt(top, sp)
  return {
    top    = top,
    bottom = top + 4 * sp,
    sp     = sp,
    y      = function(pos) return top + 4 * sp - pos * sp / 2 end,
  }
end

local function staffLines(pen, s, x1, x2, col)
  for i = 0, 4 do
    local y = s.top + i * s.sp
    pen.line(x1, y, x2, y, col, math.max(1, STAFF_TH * s.sp))
  end
end

------------------------------------------------------------------------------
-- Clefs
------------------------------------------------------------------------------

-- Each clef's SMuFL origin sits on the line it names: the G clef's spiral on
-- the second line (Sec. 6), the F clef's head and dots about the fourth
-- (Sec. 7). The kit's neutral clef claims no pitch and sits on the middle.
local CLEF = {
  treble = { glyph = "gClef",    pos = 2 },
  bass   = { glyph = "fClef",    pos = 6 },
  perc   = { glyph = "percClef", pos = 4 },
}

-- How far in from the start of the system a clef begins.
local CLEF_IN = 0.6

local function clef(pen, s, which, x, col)
  local c = CLEF[which]
  if c then glyph(pen, c.glyph, x, s.y(c.pos), s.sp, col) end
end

------------------------------------------------------------------------------
-- Accidentals
------------------------------------------------------------------------------

local ACC = { [-2] = "accidentalDoubleFlat", [-1] = "accidentalFlat",
              [0] = "accidentalNatural", [1] = "accidentalSharp",
              [2] = "accidentalDoubleSharp" }

------------------------------------------------------------------------------
-- Rests
------------------------------------------------------------------------------

-- The whole rest hangs under the fourth line and the half rest sits on the
-- third, both of them occupying the third space (Sec. 5). Everything shorter
-- is centred on the middle line, which is where Bravura draws them to sit.
local RESTS = { [1] = "restWhole", [2] = "restHalf", [4] = "restQuarter",
                [8] = "rest8th", [16] = "rest16th", [32] = "rest32nd",
                [64] = "rest64th" }

local function rest(pen, s, x, den, dotCount, col)
  local sp = s.sp
  local d = 1
  while d < den and d < 64 do d = d * 2 end
  local name = RESTS[d] or "rest64th"
  local y = s.y(den <= 1 and 6 or 4)
  centred(pen, name, x, y, sp, col)
  -- A dotted rest keeps its dot, in the third space like any other (Sec. 11).
  local g = glyphOf(name)
  for i = 1, dotCount or 0 do
    pen.circle(x + ((g.x2 - g.x1) / 2 + 0.1 + 0.5 * i) * sp, s.y(5), DOT_R * sp, col, true)
  end
end

------------------------------------------------------------------------------
-- Noteheads, stems, flags
------------------------------------------------------------------------------

local HEADS = { [1] = "noteheadWhole", [2] = "noteheadHalf" }
local CROSS = { [1] = "noteheadXWhole", [2] = "noteheadXHalf" }

local function notehead(pen, x, y, sp, kind, den, col, ground)
  if kind == "cross" or kind == "open" then
    centred(pen, CROSS[den] or "noteheadXBlack", x, y, sp, col)
    if kind == "open" then
      pen.circle(x, y - 1.0 * sp, 0.30 * sp, col, false)
    end
    return
  end

  local name = HEADS[den] or "noteheadBlack"
  local g = glyphOf(name)
  local left = x - (g.x1 + g.x2) / 2 * sp
  if g.holes then
    -- The counter of an open head is opaque, so the staff line it sits on
    -- stops at its edge rather than running through the hole: the head is
    -- filled whole and its counter punched back out with the paper.
    rings(pen, g.outer, left, y, sp, col)
    rings(pen, g.holes, left, y, sp, ground)
  else
    rings(pen, g.fill, left, y, sp, col)
  end
end

-- One flag per beam the value would carry, always on the right of the stem
-- (Sec. 1). Bravura draws one symbol for each count, hung from the stem's tip
-- with its origin on the stem's left edge.
local FLAGS = { "8th", "16th", "32nd", "64th" }

local function flag(pen, sx, tip, sp, n, dir, col)
  local name = "flag" .. FLAGS[math.min(n, #FLAGS)] .. ((dir == "up") and "Up" or "Down")
  glyph(pen, name, sx - STEM_TH * sp / 2, tip, sp, col)
end

-- The dot goes on a space, never on a line: a head on a line pushes its dot to
-- the space above (Sec. 11).
local function dots(pen, s, x, pos, n, col)
  local sp = s.sp
  local at = (pos % 2 == 0) and (pos + 1) or pos
  for i = 1, n do
    pen.circle(x + (0.05 + 0.5 * i) * sp, s.y(at), DOT_R * sp, col, true)
  end
end

------------------------------------------------------------------------------
-- A chord
------------------------------------------------------------------------------

local function chord(pen, s, el, x, col, ground)
  local sp = s.sp
  local den, dotCount = el.value.den, el.value.dots or 0
  local rx = (den <= 1) and N.WHOLE_RX or N.HEAD_RX
  local stemUp = el.stem == "up"

  -- Ledger lines first, so the heads sit on top of them. The kit gets them
  -- too: a hi-hat is written above the staff and needs its line like anything
  -- else up there.
  local half = (rx + LEDGER_EXT) * sp
  for _, h in ipairs(el.heads) do
    if h.pos < 0 then
      for p = -2, h.pos, -2 do
        pen.line(x - half, s.y(p), x + half, s.y(p), col, math.max(1, LEDGER_TH * sp))
      end
    elseif h.pos > 8 then
      for p = 10, h.pos, 2 do
        pen.line(x - half, s.y(p), x + half, s.y(p), col, math.max(1, LEDGER_TH * sp))
      end
    end
  end

  -- The accidentals go exactly where the layout put them. It knows which
  -- heads were pushed across the stem and how many columns the accidentals
  -- need; drawing them from a running offset here is what once put a sharp
  -- underneath a notehead.
  for _, h in ipairs(el.heads) do
    if h.acc and h.accDX and ACC[h.acc] then
      centred(pen, ACC[h.acc], x + h.accDX * sp, s.y(h.pos), sp, col)
    end
  end

  -- The dots line up after the rightmost head of the chord, so a head
  -- crossed to the right of the stem does not land on its neighbours' dots.
  local right = x + rx * sp
  for _, h in ipairs(el.heads) do
    -- Which side a crossed head goes is the layout's answer, not one worked
    -- out again from the stem: see `el.sideDir` in sb_notate.lua.
    local hx = x + ((h.side == 1) and (el.sideDir or 1) * 2 * rx * sp or 0)
    notehead(pen, hx, s.y(h.pos), sp, h.glyph or "normal", den, col, ground)
    right = math.max(right, hx + rx * sp)
  end
  if dotCount > 0 then
    for _, h in ipairs(el.heads) do dots(pen, s, right, h.pos, dotCount, col) end
  end

  if el.stem then
    local lo, hi = el.heads[1].pos, el.heads[#el.heads].pos
    local sx = x + (stemUp and rx * sp - STEM_TH * sp / 2
                           or -rx * sp + STEM_TH * sp / 2)
    el.stemX   = sx
    el.stemFrom = stemUp and s.y(lo) or s.y(hi)

    -- A beamed note's stem is not drawn here. How long it is depends on where
    -- the beam ends up, and that is not known until the whole group has been
    -- seen - drawing a guess first leaves the guess on the page under the beam.
    if el.beam then return end

    -- A stem is an octave long, measured from the head at the far end of the
    -- chord from the stem's tip - the lowest under an upward stem. Measuring
    -- from the near head instead makes a triad's stem half as long again as it
    -- should be, which is what a bar of chopped chords shows at a glance.
    -- A chord taller than an octave still has to clear its own top head.
    local to
    if stemUp then
      to = math.min(s.y(lo) - STEM_LEN * sp, s.y(hi + 2))
      to = math.min(to, s.y(4))          -- and it reaches the middle line
    else
      to = math.max(s.y(hi) + STEM_LEN * sp, s.y(lo - 2))
      to = math.max(to, s.y(4))
    end
    local n = N and N.hooks(el.value) or 0
    -- A flag for a thirty-second or shorter would run into its own head on a
    -- stem of the ordinary length, so the stem grows to carry it.
    if n > 2 then to = to + (stemUp and -1 or 1) * (n - 2) * 0.75 * sp end
    pen.line(sx, el.stemFrom, sx, to, col, math.max(1, STEM_TH * sp))
    el.stemTip = to
    if n > 0 then flag(pen, sx, to, sp, n, el.stem, col) end
  end
end

------------------------------------------------------------------------------
-- Beams
------------------------------------------------------------------------------

-- A beamed group is drawn after its notes, because where the beam sits decides
-- how long every stem in the group is, and the stems were drawn to reach it.
local function beamGroup(pen, s, run, col)
  local sp = s.sp
  local first, last = run[1], run[#run]
  if not (first.stemX and last.stemX) then return end

  local up = run.stem == "up"
  local sign = up and -1 or 1
  local span = last.stemX - first.stemX

  -- Two heads matter per chord: the far one, which sets how long the stem
  -- wants to be, and the near one, which the beam has to clear whatever the
  -- far one says.
  local reach, far = {}, {}
  for i, el in ipairs(run) do
    reach[i] = up and s.y(el.heads[#el.heads].pos) or s.y(el.heads[1].pos)
    far[i]   = up and s.y(el.heads[1].pos) or s.y(el.heads[#el.heads].pos)
  end

  -- The beam leans the way the notes do, but only part of the way and never
  -- past a quarter turn. A beam that followed the notes exactly would stand on
  -- end over a run of a scale, which is the shape this app makes most often.
  -- A quarter of the interval the group covers, and never more than a space
  -- and a bit. A run of a scale in sixteenths is the shape that settles this:
  -- at anything like the full interval its beams stand on end.
  local slope = (reach[#reach] - reach[1]) * 0.25
  local cap   = math.min(1.2 * sp, math.abs(span) * 0.22)
  if slope >  cap then slope =  cap end
  if slope < -cap then slope = -cap end

  -- Then slide the whole beam out until two things hold for every chord in the
  -- group: its stem is a full one measured from the far head, and the beam
  -- still clears the near head by a space. A rising run needs the first; a
  -- beamed chord needs the second.
  local MIN, CLEAR = STEM_LEN * sp, 1.0 * sp
  local base
  for i, el in ipairs(run) do
    local t = (span == 0) and 0 or (el.stemX - first.stemX) / span
    local a = far[i]   + sign * MIN   - slope * t
    local b = reach[i] + sign * CLEAR - slope * t
    local want = up and math.min(a, b) or math.max(a, b)
    if not base then base = want
    elseif up and want < base then base = want
    elseif not up and want > base then base = want end
  end

  local function yAt(x)
    if span == 0 then return base end
    return base + slope * (x - first.stemX) / span
  end

  for i, el in ipairs(run) do
    local y = yAt(el.stemX)
    pen.line(el.stemX, el.stemFrom, el.stemX, y, col, math.max(1, STEM_TH * sp))
    el.beamTip, el.stemTip = y, y
  end

  local most = 0
  for _, el in ipairs(run) do most = math.max(most, N and N.hooks(el.value) or 1) end

  for level = 0, most - 1 do
    local dy = sign * level * (BEAM_TH + BEAM_GAP) * sp
    -- Each beam level runs only under the notes that actually carry it, which
    -- is what turns a dotted eighth and a sixteenth into a beam and a stub
    -- rather than two full beams.
    local i = 1
    while i <= #run do
      local has = (N and N.hooks(run[i].value) or 0) > level
      if not has then i = i + 1
      else
        local j = i
        while j + 1 <= #run and (N and N.hooks(run[j + 1].value) or 0) > level do
          j = j + 1
        end
        -- Out to the stems' outer edges, so no stem pokes past its beam.
        local xa, xb = run[i].stemX - STEM_TH * sp / 2, run[j].stemX + STEM_TH * sp / 2
        if i == j then
          -- A stub, pointing back into the group it belongs to.
          local dir = (i > 1) and -1 or 1
          xa = run[i].stemX + (dir > 0 and -1 or 1) * STEM_TH * sp / 2
          xb = xa + dir * 1.1 * sp
          if xb < xa then xa, xb = xb, xa end
        end
        local ya, yb = yAt(xa) + dy, yAt(xb) + dy
        local t = sign * BEAM_TH * sp
        fill(pen, { xa, ya, xb, yb, xb, yb - t, xa, ya - t }, col)
        i = j + 1
      end
    end
  end
end

------------------------------------------------------------------------------
-- Ties
------------------------------------------------------------------------------

-- A tie is a crescent, thin at its ends and thickest at its middle, the way
-- an engraver's tie is - a stroke of even weight reads as a slur drawn with a
-- ruler. It starts and ends a little inside the two heads' centres and
-- arches away from the stems.
local function tie(pen, s, x1, y1, x2, y2, below, col)
  local sp = s.sp
  local dir = below and 1 or -1
  local xa, xb = x1 + 0.3 * sp, x2 - 0.3 * sp
  local ya, yb = y1 + dir * 0.45 * sp, y2 + dir * 0.45 * sp
  local len = math.max(xb - xa, 0.5 * sp)
  local bow = math.min(0.9, 0.3 + len / sp * 0.05) * sp
  local inner = bow - TIE_MID * sp
  local pts = {}
  bezier(pts, xa, ya, xa + len * 0.25, ya + dir * bow * 4 / 3,
              xb - len * 0.25, yb + dir * bow * 4 / 3, xb, yb, 16)
  local back = {}
  bezier(back, xb, yb, xb - len * 0.25, yb + dir * inner * 4 / 3,
               xa + len * 0.25, ya + dir * inner * 4 / 3, xa, ya, 16)
  -- The two curves share their ends; dropping the repeats keeps the outline
  -- a simple polygon.
  for k = 3, #back - 2 do pts[#pts + 1] = back[k] end
  fill(pen, pts, col)
end

------------------------------------------------------------------------------
-- Key and time signatures
------------------------------------------------------------------------------

-- Where each accidental of a signature sits, in half-spaces above the bottom
-- line. Two rows per clef, because a signature is written in one fixed shape
-- and the shape is not the same for sharps as for flats.
local SIG_POS = {
  treble = { sharp = { 8, 5, 9, 6, 3, 7, 4 }, flat = { 4, 7, 3, 6, 2, 5, 1 } },
  bass   = { sharp = { 6, 3, 7, 4, 1, 5, 2 }, flat = { 2, 5, 1, 4, 0, 3, -1 } },
}

local function keySignature(pen, s, clef, sig, x, col)
  if clef == "perc" or sig.count == 0 then return x end
  local rows = SIG_POS[clef]
  if not rows then return x end
  local list = rows[sig.kind]
  local name = (sig.kind == "flat") and "accidentalFlat" or "accidentalSharp"
  local step = (N and N.SIG_STEP or 1.0) * s.sp
  for i = 1, math.min(sig.count, 7) do
    centred(pen, name, x + step / 2, s.y(list[i]), s.sp, col)
    x = x + step
  end
  return x + 0.5 * s.sp
end

-- A row of Bravura's figures, centred on x with their middles on y. The time
-- signature's figures are drawn like everything else now, so they scale with
-- the staff on every ReaImGui rather than only on one that can size text.
local function figures(pen, prefix, value, x, y, sp, col, k)
  k = k or 1
  local str = tostring(value)
  local w, gap = 0, 0.08
  for c in str:gmatch("%d") do w = w + glyphOf(prefix .. c).x2 * k + gap end
  w = w - gap
  local at = x - w * sp / 2
  for c in str:gmatch("%d") do
    local g = glyphOf(prefix .. c)
    glyph(pen, prefix .. c, at, y, sp, col, k, k)
    at = at + (g.x2 * k + gap) * sp
  end
end

local function timeSignature(pen, s, time, x, col)
  local sp = s.sp
  local w  = (N and N.timeWidth and N.timeWidth(time) or 2.4) * sp
  figures(pen, "timeSig", time.num, x + w / 2, s.y(6), sp, col)
  figures(pen, "timeSig", time.den, x + w / 2, s.y(2), sp, col)
  return x + w
end

------------------------------------------------------------------------------
-- The page
------------------------------------------------------------------------------

-- How far above the top line and below the bottom line this document actually
-- reaches: ledger lines, a beam over a high run, the figure over a tuplet. A
-- page reserved at the height of its staves alone clips exactly the things
-- that are furthest from them.
function D.margins(doc)
  local above, below = 1.0, 1.0
  for _, m in ipairs(doc.measures or {}) do
    for _, staff in ipairs(m.staves or {}) do
      for _, el in ipairs(staff.elements or {}) do
        for _, h in ipairs(el.heads or {}) do
          above = math.max(above, (h.pos - 8) / 2 + 1.2)
          below = math.max(below, (0 - h.pos) / 2 + 1.2)
        end
        if el.tieOut and el.heads and el.heads[1] then
          -- A tie bows out past the outermost heads.
          above = math.max(above, (el.heads[#el.heads].pos - 8) / 2 + 1.7)
          below = math.max(below, (0 - el.heads[1].pos) / 2 + 1.7)
        end
        if el.kind == "chord" then
          -- A stem, and then the hook or the beam and its figure on top of it.
          local reach = STEM_LEN + 1.8
                        + math.max(0, (N and N.hooks(el.value) or 0) - 2) * 0.75
          for _, h in ipairs(el.heads or {}) do
            if el.stem == "up" then
              above = math.max(above, (h.pos - 8) / 2 + reach)
            elseif el.stem == "down" then
              below = math.max(below, (0 - h.pos) / 2 + reach)
            end
          end
        end
      end
    end
  end
  return above, below
end

-- How tall a page will be, so the window can reserve the room before drawing.
function D.height(doc, sp, opts)
  opts = opts or {}
  local staves = #doc.staves
  local system = staves * 4 * sp + (staves - 1) * (opts.staffGap or 4.6) * sp
  local gap    = (opts.systemGap or 3.2) * sp
  local n      = doc.systems and #doc.systems or 1
  local above, below = D.margins(doc)
  return n * (system + (above + below) * sp) + (n - 1) * gap
         + 2 * (opts.pad or 1.2) * sp
end

-- Draws the whole document. `col` carries the four colours the page uses:
-- the ink, the staff lines, the ground the open noteheads punch through, and
-- the accent a highlighted note takes.
-- The gap between the staves of a great staff is wide on purpose. At a couple
-- of spaces the two of them read as one ten-line staff and a chord spanning
-- middle C looks like a single stack of notes, which is the one thing the
-- great staff exists to avoid.
function D.page(pen, doc, x0, y0, sp, col, opts)
  opts = opts or {}
  local staffGap  = (opts.staffGap or 4.6) * sp
  local systemGap = (opts.systemGap or 3.2) * sp
  local pad       = (opts.pad or 1.2) * sp
  local ink       = col.ink
  local lineCol   = col.staff or col.ink
  local ground    = col.ground

  -- The same margins D.height reserved, so what was measured is what is drawn.
  local above, below = D.margins(doc)
  local y = y0 + pad + above * sp
  local systems = doc.systems or { doc.measures }

  for _, sys in ipairs(systems) do
    local scale = sys.scale or 1
    local staffTops = {}
    for i = 1, #doc.staves do
      staffTops[i] = y + (i - 1) * (4 * sp + staffGap)
    end
    local sysBottom = staffTops[#doc.staves] + 4 * sp

    -- How wide this system runs, so the staff lines and the final bar line
    -- stop in the same place.
    local total = doc.headWidth * sp
    for _, m in ipairs(sys) do total = total + m.width * sp * scale end
    local right = x0 + total

    -- The clef, the signature and the time all come out of the same numbers
    -- sb_notate reserved room for, so the first note of the bar lands exactly
    -- where the layout said it would.
    for i, sdef in ipairs(doc.staves) do
      local s = staffAt(staffTops[i], sp)
      staffLines(pen, s, x0, right, lineCol)

      clef(pen, s, sdef.clef, x0 + CLEF_IN * sp, ink)
      local after = keySignature(pen, s, sdef.clef, doc.sig,
                                 x0 + (N and N.CLEF_WIDTH or 4.0) * sp, ink)
      timeSignature(pen, s, doc.time, after, ink)
    end

    -- The brace and the bar line that join a great staff into one system.
    -- Bravura's brace is drawn for one staff; it is stretched to the system's
    -- height and widened in proportion, but less, so a tall one stays a brace
    -- rather than becoming a wedge.
    if #doc.staves > 1 then
      local top, bot = staffTops[1], sysBottom
      pen.line(x0, top, x0, bot, ink, math.max(1, BAR_TH * sp))
      local g = glyphOf("brace")
      local ky = (bot - top) / ((g.y2 - g.y1) * sp)
      local kx = math.sqrt(ky) * 1.6
      glyph(pen, "brace", x0 - 0.35 * sp - g.x2 * kx * sp, bot - g.y2 * ky * sp,
            sp, ink, kx, ky)
    end

    local mx = x0 + doc.headWidth * sp
    for mi, m in ipairs(sys) do
      local mw = m.width * sp * scale

      for si, sdef in ipairs(doc.staves) do
        local s = staffAt(staffTops[si], sp)
        local staff = m.staves[si]
        if staff then
          for _, el in ipairs(staff.elements) do
            local ex = mx + el.x * sp * scale
            if el.kind == "rest" then
              rest(pen, s, ex, el.measureRest and 1 or el.value.den,
                   el.value.dots or 0, ink)
            else
              local c = (opts.highlight and opts.highlight(el)) and col.accent or ink
              chord(pen, s, el, ex, c, ground)
              el.screenX = ex
            end
          end

          -- Beams, then the figures over the tuplets, then the ties.
          local drawn = {}
          for _, el in ipairs(staff.elements) do
            if el.beam and not drawn[el.beam] and el.beam[1].stemX then
              drawn[el.beam] = true
              beamGroup(pen, s, el.beam, ink)
            end
          end

          for _, g in ipairs(staff.tuplets or {}) do
            local a, b = g.elements[1], g.elements[#g.elements]
            if a.stemX and b.stemX then
              local up = a.stem == "up"
              local ty = up and math.min(a.beamTip or a.stemTip or s.y(8),
                                         b.beamTip or b.stemTip or s.y(8)) - 1.0 * sp
                             or math.max(a.beamTip or a.stemTip or s.y(0),
                                         b.beamTip or b.stemTip or s.y(0)) + 1.0 * sp
              local xa, xb = a.stemX, b.stemX
              if g.bracket then
                local th = math.max(1, TUPLET_TH * sp)
                local drop = up and 0.5 * sp or -0.5 * sp
                pen.line(xa, ty + drop, xa, ty, ink, th)
                pen.line(xb, ty + drop, xb, ty, ink, th)
                local mid = (xa + xb) / 2
                pen.line(xa, ty, mid - 0.7 * sp, ty, ink, th)
                pen.line(mid + 0.7 * sp, ty, xb, ty, ink, th)
              end
              -- Bravura's tuplet figures stand on their baseline and are a
              -- space and a half tall; at eight tenths they sit centred on
              -- the bracket's line.
              figures(pen, "tuplet", g.n, (xa + xb) / 2, ty + 0.6 * sp, sp, ink, 0.8)
            end
          end

          -- A tie runs to the note it holds into: the next in the bar, or
          -- across the bar line to the first of the next bar when that is on
          -- the same system. At the end of a system it runs out to the edge.
          for i, el in ipairs(staff.elements) do
            if el.tieOut and el.screenX then
              local nxt = staff.elements[i + 1]
              local x2 = nxt and nxt.screenX
              local follow = sys[mi + 1] and sys[mi + 1].staves[si]
              if not x2 and follow and follow.elements[1] then
                x2 = mx + mw + follow.elements[1].x * sp * scale
              end
              x2 = x2 or (mx + mw - 0.6 * sp)
              local rx = ((el.value.den <= 1) and N.WHOLE_RX or N.HEAD_RX) * sp
              local n = #el.heads
              -- Every note of a tied chord is tied. One note bows away from
              -- its stem; in a chord the lower half bow down and the upper
              -- half up, each starting beside its head rather than under it.
              for k, h in ipairs(el.heads) do
                local below
                if n == 1 then below = el.stem == "up"
                else below = k <= n / 2 end
                local y = s.y(h.pos)
                if n == 1 then
                  tie(pen, s, el.screenX, y, x2, y, below, ink)
                else
                  tie(pen, s, el.screenX + rx - 0.1 * sp, y + (below and -0.25 or 0.25) * sp,
                      x2 - rx + 0.1 * sp, y + (below and -0.25 or 0.25) * sp, below, ink)
                end
              end
            end
          end
        end
      end

      -- One bar line down the whole system, so a great staff reads as one.
      mx = mx + mw
      local last = (mi == #sys)
      local top, bot = staffTops[1], sysBottom
      if last and sys == systems[#systems] then
        -- The final bar: a thin line and a thick one, the thick flush with
        -- where the staff stops.
        local thinX = mx - (THICK_BAR + BAR_SEP + BAR_TH / 2) * sp
        pen.line(thinX, top, thinX, bot, ink, math.max(1, BAR_TH * sp))
        fill(pen, { mx - THICK_BAR * sp, top, mx, top, mx, bot, mx - THICK_BAR * sp, bot }, ink)
      else
        pen.line(mx, top, mx, bot, ink, math.max(1, BAR_TH * sp))
      end
    end

    y = sysBottom + below * sp + systemGap + above * sp
  end

  -- What was drawn is what the window was told to reserve, by construction:
  -- two expressions for one number is two expressions to keep in step, and
  -- the one that drifts is always the one nobody is looking at.
  return D.height(doc, sp, opts)
end

return D
