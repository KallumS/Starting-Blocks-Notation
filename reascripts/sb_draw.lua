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
 * The glyphs are drawn rather than set in a music font, because a REAPER user
 * has no reason to have one installed and an app that looks wrong on someone
 * else's machine is worse than one that draws its own.
--]]

local D = {}

local N = nil
function D.setNotate(n) N = n end

------------------------------------------------------------------------------
-- Proportions
------------------------------------------------------------------------------

-- All of these are in staff spaces. The notehead is the one worth knowing: a
-- shade wider than it is tall and tilted up to the right, which is what makes
-- a chord's heads sit against each other rather than in a column.
-- The head's width is `N.HEAD_RX`, not a constant here: the layout needs the
-- same number to work out where the accidental in front of a head goes, and
-- two copies of it would be two copies to keep in step.
local HEAD_RY     = 0.50
local HEAD_TILT   = -20 * math.pi / 180
local WHOLE_RY    = 0.50

local STAFF_TH    = 0.10
local LEDGER_TH   = 0.13
local LEDGER_HALF = 0.92
local STEM_TH     = 0.13
local STEM_LEN    = 3.5
local BEAM_TH     = 0.50
local BEAM_GAP    = 0.28
local BAR_TH      = 0.12
local HOOK_TH     = 0.30

------------------------------------------------------------------------------
-- Curves
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

-- A path as a run of short straight pieces. Sampled finely enough that the
-- notches where one piece meets the next do not show.
local function stroke(pen, pts, col, th)
  for i = 1, #pts - 3, 2 do
    pen.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], col, th)
  end
end

-- A tilted ellipse as a polygon. Convex, so the pen can fill it in one call.
local function ellipse(pen, cx, cy, rx, ry, angle, col, sides)
  sides = sides or 20
  local pts, ca, sa = {}, math.cos(angle), math.sin(angle)
  for i = 0, sides - 1 do
    local t = i / sides * 2 * math.pi
    local x, y = rx * math.cos(t), ry * math.sin(t)
    pts[#pts + 1] = cx + x * ca - y * sa
    pts[#pts + 1] = cy + x * sa + y * ca
  end
  pen.poly(pts, col)
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

-- The G clef, drawn from the second line outwards the way Gehrkens says to
-- make one (Sec. 6): the circular part sits over the first and second spaces
-- and the descending stroke crosses the ascending curve near the fourth line.
-- The curl is a real spiral rather than a guessed curve, because a spiral is
-- the one part of the shape the eye checks.
local function trebleClef(pen, s, x, col)
  local sp = s.sp
  local gy = s.y(2)                       -- the second line: the G it names
  local th = math.max(1, 0.17 * sp)

  -- The loop: down from the top, crossing the stem near the fourth line, out
  -- wide to the left, under, and then wound in to the G line itself.
  local loop = {}
  bezier(loop, x + 0.10 * sp, gy - 3.90 * sp,
               x - 0.32 * sp, gy - 4.08 * sp,
               x - 0.62 * sp, gy - 3.52 * sp,
               x - 0.55 * sp, gy - 2.95 * sp)
  bezier(loop, x - 0.55 * sp, gy - 2.95 * sp,
               x - 0.48 * sp, gy - 2.40 * sp,
               x - 0.12 * sp, gy - 2.22 * sp,
               x + 0.14 * sp, gy - 1.95 * sp)
  bezier(loop, x + 0.14 * sp, gy - 1.95 * sp,
               x + 0.58 * sp, gy - 1.52 * sp,
               x + 0.82 * sp, gy - 1.05 * sp,
               x + 0.78 * sp, gy - 0.50 * sp)
  bezier(loop, x + 0.78 * sp, gy - 0.50 * sp,
               x + 0.72 * sp, gy + 0.40 * sp,
               x + 0.40 * sp, gy + 1.12 * sp,
               x - 0.12 * sp, gy + 1.15 * sp)
  bezier(loop, x - 0.12 * sp, gy + 1.15 * sp,
               x - 0.72 * sp, gy + 1.18 * sp,
               x - 1.12 * sp, gy + 0.70 * sp,
               x - 1.08 * sp, gy + 0.05 * sp)
  bezier(loop, x - 1.08 * sp, gy + 0.05 * sp,
               x - 1.04 * sp, gy - 0.60 * sp,
               x - 0.62 * sp, gy - 0.95 * sp,
               x - 0.18 * sp, gy - 0.92 * sp)
  bezier(loop, x - 0.18 * sp, gy - 0.92 * sp,
               x + 0.18 * sp, gy - 0.90 * sp,
               x + 0.38 * sp, gy - 0.62 * sp,
               x + 0.30 * sp, gy - 0.26 * sp)
  bezier(loop, x + 0.30 * sp, gy - 0.26 * sp,
               x + 0.24 * sp, gy + 0.02 * sp,
               x + 0.02 * sp, gy + 0.14 * sp,
               x - 0.16 * sp, gy + 0.10 * sp)
  stroke(pen, loop, col, th)

  -- The stem, from the top terminal down to the hook under the staff.
  local stem = {}
  bezier(stem, x + 0.10 * sp, gy - 3.90 * sp,
               x + 0.30 * sp, gy - 2.60 * sp,
               x + 0.26 * sp, gy - 1.10 * sp,
               x + 0.10 * sp, gy + 0.40 * sp)
  bezier(stem, x + 0.10 * sp, gy + 0.40 * sp,
               x - 0.02 * sp, gy + 1.35 * sp,
               x - 0.22 * sp, gy + 1.80 * sp,
               x - 0.34 * sp, gy + 2.15 * sp)
  bezier(stem, x - 0.34 * sp, gy + 2.15 * sp,
               x - 0.52 * sp, gy + 2.70 * sp,
               x + 0.18 * sp, gy + 2.88 * sp,
               x + 0.24 * sp, gy + 2.30 * sp)
  stroke(pen, stem, col, th)

  -- The eye of the spiral, sitting on the line the clef names.
  pen.circle(x - 0.16 * sp, gy + 0.10 * sp, 0.17 * sp, col, true)
end

-- The F clef: the head and its curve, and the two dots either side of the
-- fourth line, which is the line it marks (Sec. 7).
local function bassClef(pen, s, x, col)
  local sp = s.sp
  local fy = s.y(6)                       -- the fourth line: the F it names
  local th = math.max(1, 0.22 * sp)

  pen.circle(x, fy, 0.46 * sp, col, true)
  local pts = {}
  bezier(pts, x + 0.02 * sp, fy - 0.45 * sp,
              x + 0.72 * sp, fy - 0.62 * sp,
              x + 1.08 * sp, fy + 0.10 * sp,
              x + 1.02 * sp, fy + 0.80 * sp)
  bezier(pts, x + 1.02 * sp, fy + 0.80 * sp,
              x + 0.94 * sp, fy + 1.70 * sp,
              x + 0.30 * sp, fy + 2.35 * sp,
              x - 0.55 * sp, fy + 2.70 * sp)
  stroke(pen, pts, col, th)
  -- The two dots, one either side of the fourth line, which is the line the
  -- clef marks (Sec. 7).
  pen.circle(x + 1.42 * sp, s.y(7), 0.15 * sp, col, true)
  pen.circle(x + 1.42 * sp, s.y(5), 0.15 * sp, col, true)
end

-- The neutral clef the kit is written under: two heavy bars, no pitch claimed.
local function percClef(pen, s, x, col)
  local sp = s.sp
  for _, dx in ipairs({ -0.18, 0.32 }) do
    pen.line(x + dx * sp, s.y(2), x + dx * sp, s.y(6), col, 0.30 * sp)
  end
end

local CLEF = { treble = trebleClef, bass = bassClef, perc = percClef }

------------------------------------------------------------------------------
-- Accidentals
------------------------------------------------------------------------------

-- Two light verticals and two heavy slants, upward from left to right, and
-- never the typewriter's hash (Sec. 8).
local function sharp(pen, x, y, sp, col)
  local light, heavy = math.max(1, 0.10 * sp), math.max(1, 0.20 * sp)
  for _, dx in ipairs({ -0.17, 0.17 }) do
    pen.line(x + dx * sp, y - 0.82 * sp, x + dx * sp, y + 0.62 * sp, col, light)
  end
  for _, dy in ipairs({ -0.24, 0.24 }) do
    pen.line(x - 0.36 * sp, y + dy * sp + 0.12 * sp,
             x + 0.36 * sp, y + dy * sp - 0.12 * sp, col, heavy)
  end
end

-- A down stroke retraced part way up, the curve made without lifting the pen
-- (Sec. 9).
local function flat(pen, x, y, sp, col)
  local th = math.max(1, 0.13 * sp)
  pen.line(x - 0.20 * sp, y - 1.05 * sp, x - 0.20 * sp, y + 0.50 * sp, col, th)
  local pts = {}
  bezier(pts, x - 0.20 * sp, y + 0.50 * sp,
              x + 0.55 * sp, y + 0.16 * sp,
              x + 0.40 * sp, y - 0.52 * sp,
              x - 0.20 * sp, y - 0.05 * sp)
  stroke(pen, pts, col, math.max(1, 0.15 * sp))
end

-- Down-right, then right-down (Sec. 9).
local function natural(pen, x, y, sp, col)
  local light, heavy = math.max(1, 0.10 * sp), math.max(1, 0.18 * sp)
  pen.line(x - 0.18 * sp, y - 0.85 * sp, x - 0.18 * sp, y + 0.42 * sp, col, light)
  pen.line(x + 0.18 * sp, y - 0.42 * sp, x + 0.18 * sp, y + 0.85 * sp, col, light)
  pen.line(x - 0.18 * sp, y - 0.30 * sp, x + 0.18 * sp, y - 0.44 * sp, col, heavy)
  pen.line(x - 0.18 * sp, y + 0.44 * sp, x + 0.18 * sp, y + 0.30 * sp, col, heavy)
end

-- The saltire form, which is the commoner of the two the book gives (Sec. 8).
local function doubleSharp(pen, x, y, sp, col)
  local th = math.max(1, 0.24 * sp)
  pen.line(x - 0.30 * sp, y - 0.30 * sp, x + 0.30 * sp, y + 0.30 * sp, col, th)
  pen.line(x - 0.30 * sp, y + 0.30 * sp, x + 0.30 * sp, y - 0.30 * sp, col, th)
end

local function doubleFlat(pen, x, y, sp, col)
  flat(pen, x - 0.34 * sp, y, sp, col)
  flat(pen, x + 0.26 * sp, y, sp, col)
end

local ACC = { [-2] = doubleFlat, [-1] = flat, [0] = natural,
              [1] = sharp, [2] = doubleSharp }

------------------------------------------------------------------------------
-- Rests
------------------------------------------------------------------------------

-- The whole rest hangs under the fourth line and the half rest sits on the
-- third, both of them occupying the third space (Sec. 5).
local function rest(pen, s, x, den, dots, col)
  local sp = s.sp
  if den <= 1 then
    pen.poly({ x - 0.55 * sp, s.y(6), x + 0.55 * sp, s.y(6),
               x + 0.55 * sp, s.y(6) + 0.52 * sp, x - 0.55 * sp, s.y(6) + 0.52 * sp }, col)
    return
  end
  if den == 2 then
    pen.poly({ x - 0.55 * sp, s.y(4) - 0.52 * sp, x + 0.55 * sp, s.y(4) - 0.52 * sp,
               x + 0.55 * sp, s.y(4), x - 0.55 * sp, s.y(4) }, col)
    return
  end
  if den == 4 then
    -- The quarter rest, as the stroke it is: down-right, back, down-right,
    -- and the small hook at the foot.
    local y = s.y(4)
    local pts = {}
    bezier(pts, x - 0.26 * sp, y - 1.30 * sp,
                x + 0.16 * sp, y - 0.85 * sp,
                x + 0.16 * sp, y - 0.75 * sp,
                x - 0.20 * sp, y - 0.30 * sp)
    bezier(pts, x - 0.20 * sp, y - 0.30 * sp,
                x - 0.52 * sp, y + 0.10 * sp,
                x - 0.30 * sp, y + 0.25 * sp,
                x + 0.22 * sp, y + 0.62 * sp)
    bezier(pts, x + 0.22 * sp, y + 0.62 * sp,
                x - 0.30 * sp, y + 0.35 * sp,
                x - 0.42 * sp, y + 0.85 * sp,
                x + 0.02 * sp, y + 1.32 * sp)
    stroke(pen, pts, col, math.max(1, 0.20 * sp))
    return
  end

  -- Eighth and shorter: one slanting stroke, and a hook for each beam the
  -- matching note would carry. The eighth's hook goes on the third space.
  local hooks = 0
  local d = 4
  while d < den do d, hooks = d * 2, hooks + 1 end
  local topPos    = 5 + (hooks - 1)
  local bottomPos = topPos - 1.6 - 1.1 * (hooks - 1)
  pen.line(x + 0.26 * sp, s.y(topPos), x - 0.20 * sp, s.y(bottomPos), col,
           math.max(1, 0.14 * sp))
  for i = 0, hooks - 1 do
    local hy = s.y(topPos - i * 1.1)
    pen.circle(x + 0.20 * sp, hy, 0.19 * sp, col, true)
    local pts = {}
    bezier(pts, x + 0.20 * sp, hy,
                x - 0.10 * sp, hy - 0.10 * sp,
                x - 0.36 * sp, hy - 0.18 * sp,
                x - 0.48 * sp, hy - 0.02 * sp)
    stroke(pen, pts, col, math.max(1, 0.12 * sp))
  end
end

------------------------------------------------------------------------------
-- Noteheads, stems, hooks
------------------------------------------------------------------------------

local function notehead(pen, x, y, sp, glyph, den, col, ground)
  if glyph == "cross" or glyph == "open" then
    local r, th = 0.52 * sp, math.max(1, 0.18 * sp)
    pen.line(x - r, y - r, x + r, y + r, col, th)
    pen.line(x - r, y + r, x + r, y - r, col, th)
    if glyph == "open" then
      pen.circle(x, y - 1.0 * sp, 0.30 * sp, col, false)
    end
    return
  end

  if den <= 1 then
    ellipse(pen, x, y, N.WHOLE_RX * sp, WHOLE_RY * sp, 0, col)
    ellipse(pen, x, y, 0.44 * sp, 0.26 * sp, HEAD_TILT, ground)
    return
  end
  ellipse(pen, x, y, N.HEAD_RX * sp, HEAD_RY * sp, HEAD_TILT, col)
  if den == 2 then
    -- The counter of an open head is opaque, so the staff line it sits on
    -- stops at its edge rather than running through the hole.
    ellipse(pen, x, y, 0.33 * sp, 0.26 * sp, HEAD_TILT, ground)
  end
end

-- A hook per beam the value carries, always on the right of the stem (Sec. 1).
local function hooks(pen, x, y, sp, n, dir, col)
  local sign = (dir == "up") and 1 or -1
  for i = 0, n - 1 do
    local sy = y + sign * i * 0.72 * sp
    local pts = {}
    bezier(pts, x, sy,
                x + 0.56 * sp, sy - sign * 0.06 * sp,
                x + 0.68 * sp, sy - sign * 0.48 * sp,
                x + 0.40 * sp, sy - sign * 1.05 * sp)
    stroke(pen, pts, col, math.max(1, HOOK_TH * sp))
  end
end

-- The dot goes on a space, never on a line: a head on a line pushes its dot to
-- the space above (Sec. 11).
local function dots(pen, s, x, pos, n, col)
  local sp = s.sp
  local at = (pos % 2 == 0) and (pos + 1) or pos
  for i = 1, n do
    pen.circle(x + (0.30 + 0.38 * i) * sp, s.y(at), 0.15 * sp, col, true)
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
  for _, h in ipairs(el.heads) do
    if h.pos < 0 then
      for p = -2, h.pos, -2 do
        pen.line(x - LEDGER_HALF * sp, s.y(p), x + LEDGER_HALF * sp, s.y(p),
                 col, math.max(1, LEDGER_TH * sp))
      end
    elseif h.pos > 8 then
      for p = 10, h.pos, 2 do
        pen.line(x - LEDGER_HALF * sp, s.y(p), x + LEDGER_HALF * sp, s.y(p),
                 col, math.max(1, LEDGER_TH * sp))
      end
    end
  end

  -- The accidentals go exactly where the layout put them. It knows which
  -- heads were pushed across the stem and how many columns the accidentals
  -- need; drawing them from a running offset here is what once put a sharp
  -- underneath a notehead.
  for _, h in ipairs(el.heads) do
    if h.acc and h.accDX and ACC[h.acc] then
      ACC[h.acc](pen, x + h.accDX * sp, s.y(h.pos), sp, col)
    end
  end

  for _, h in ipairs(el.heads) do
    -- Which side a crossed head goes is the layout's answer, not one worked
    -- out again from the stem: see `el.sideDir` in sb_notate.lua.
    local hx = x + ((h.side == 1) and (el.sideDir or 1) * 2 * rx * sp or 0)
    notehead(pen, hx, s.y(h.pos), sp, h.glyph or "normal", den, col, ground)
    if dotCount > 0 then dots(pen, s, hx + rx * sp, h.pos, dotCount, col) end
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
    pen.line(sx, el.stemFrom, sx, to, col, math.max(1, STEM_TH * sp))
    el.stemTip = to

    local n = N and N.hooks(el.value) or 0
    if n > 0 then hooks(pen, sx, to, sp, n, el.stem, col) end
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
        local xa, xb = run[i].stemX, run[j].stemX
        if i == j then
          -- A stub, pointing back into the group it belongs to.
          local dir = (i > 1) and -1 or 1
          xb = xa + dir * 0.75 * sp
          if xb < xa then xa, xb = xb, xa end
        end
        local ya, yb = yAt(xa) + dy, yAt(xb) + dy
        local t = sign * BEAM_TH * sp
        pen.poly({ xa, ya, xb, yb, xb, yb - t, xa, ya - t }, col)
        i = j + 1
      end
    end
  end
end

------------------------------------------------------------------------------
-- Ties
------------------------------------------------------------------------------

local function tie(pen, s, x1, y1, x2, y2, below, col)
  local sp = s.sp
  local bow = below and 0.85 * sp or -0.85 * sp
  local pts = {}
  bezier(pts, x1, y1 + (below and 0.42 or -0.42) * sp,
              x1 + (x2 - x1) * 0.25, y1 + bow,
              x1 + (x2 - x1) * 0.75, y2 + bow,
              x2, y2 + (below and 0.42 or -0.42) * sp, 12)
  stroke(pen, pts, col, math.max(1, 0.12 * sp))
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
  local glyph = (sig.kind == "flat") and flat or sharp
  local step = (N and N.SIG_STEP or 0.9) * s.sp
  for i = 1, math.min(sig.count, 7) do
    glyph(pen, x + step / 2, s.y(list[i]), s.sp, col)
    x = x + step
  end
  return x + 0.5 * s.sp
end

local function timeSignature(pen, s, num, den, x, col)
  local sp = s.sp
  local w  = (N and N.TIME_WIDTH or 2.4) * sp
  pen.text(x + w / 2, s.y(6), col, tostring(num), 1.75 * sp, true)
  pen.text(x + w / 2, s.y(2), col, tostring(den), 1.75 * sp, true)
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
        if el.kind == "chord" then
          -- A stem, and then the hook or the beam and its figure on top of it.
          local reach = STEM_LEN + 1.8
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

      if CLEF[sdef.clef] then
        CLEF[sdef.clef](pen, s, x0 + (N and N.CLEF_WIDTH or 3.2) * sp * 0.55, ink)
      end
      local after = keySignature(pen, s, sdef.clef, doc.sig,
                                 x0 + (N and N.CLEF_WIDTH or 3.2) * sp, ink)
      timeSignature(pen, s, doc.time.num, doc.time.den, after, ink)
    end

    -- The brace and the bar line that join a great staff into one system. One
    -- curve, widest at the middle: two of them meeting made a shape that read
    -- as a rounded rectangle rather than as a brace.
    if #doc.staves > 1 then
      local top, bot = staffTops[1], sysBottom
      local mid = (top + bot) / 2
      pen.line(x0, top, x0, bot, ink, math.max(1, 0.18 * sp))
      local pts = {}
      bezier(pts, x0 - 0.10 * sp, top,
                  x0 - 0.95 * sp, top + (bot - top) * 0.18,
                  x0 - 0.95 * sp, mid - (bot - top) * 0.14,
                  x0 - 1.00 * sp, mid)
      bezier(pts, x0 - 1.00 * sp, mid,
                  x0 - 0.95 * sp, mid + (bot - top) * 0.14,
                  x0 - 0.95 * sp, bot - (bot - top) * 0.18,
                  x0 - 0.10 * sp, bot)
      stroke(pen, pts, ink, math.max(1, 0.16 * sp))
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
                local drop = up and 0.45 * sp or -0.45 * sp
                pen.line(xa, ty + drop, xa, ty, ink, math.max(1, 0.10 * sp))
                pen.line(xb, ty + drop, xb, ty, ink, math.max(1, 0.10 * sp))
                local mid = (xa + xb) / 2
                pen.line(xa, ty, mid - 0.45 * sp, ty, ink, math.max(1, 0.10 * sp))
                pen.line(mid + 0.45 * sp, ty, xb, ty, ink, math.max(1, 0.10 * sp))
              end
              pen.text((xa + xb) / 2, ty, ink, tostring(g.n), 1.1 * sp, true)
            end
          end

          for i, el in ipairs(staff.elements) do
            if el.tieOut and el.screenX then
              local nxt = staff.elements[i + 1]
              local x2 = (nxt and nxt.screenX) or (mx + mw - 0.6 * sp)
              local below = el.stem == "up"
              local h = below and el.heads[1] or el.heads[#el.heads]
              tie(pen, s, el.screenX, s.y(h.pos), x2, s.y(h.pos), below, ink)
            end
          end
        end
      end

      -- One bar line down the whole system, so a great staff reads as one.
      mx = mx + mw
      local last = (mi == #sys)
      local top, bot = staffTops[1], sysBottom
      if last and sys == systems[#systems] then
        pen.line(mx - 0.55 * sp, top, mx - 0.55 * sp, bot, ink, math.max(1, BAR_TH * sp))
        pen.line(mx - 0.05 * sp, top, mx - 0.05 * sp, bot, ink, math.max(1, 0.34 * sp))
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
