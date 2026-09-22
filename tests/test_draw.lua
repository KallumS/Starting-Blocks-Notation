--[[ The engraving, by drawing it.

     `sb_draw.lua` draws through a pen rather than through ImGui, so this hands
     it one that writes down every mark instead of making one. That is the only
     reason an assertion about a stem, a ledger line or a hook can exist at
     all: the marks are values here, not pixels somebody has to look at.

     It cannot tell you the page looks right - `tools/preview_page.lua` draws
     the same page through an SVG pen for that. It can tell you that every
     block draws, that nothing lands outside the room the window was told to
     reserve, and that the rules the drawing claims to follow are followed.

       lua5.4 tests/test_draw.lua
       python3 tools/run_lua.py tests/test_draw.lua
]]

local HERE = (arg and arg[0] or ""):match("^(.*)[/\\]") or "."
local E = dofile(HERE .. "/../reascripts/sb_engine.lua")
local N = dofile(HERE .. "/../reascripts/sb_notate.lua")
local D = dofile(HERE .. "/../reascripts/sb_draw.lua")
D.setNotate(N)

local failures, checks = 0, 0
local function ok(cond, what)
  checks = checks + 1
  if not cond then failures = failures + 1; io.write("FAIL  ", what, "\n") end
end
local function eq(got, want, what)
  checks = checks + 1
  if got ~= want then
    failures = failures + 1
    io.write("FAIL  ", what, "\n        got  ", tostring(got),
             "\n        want ", tostring(want), "\n")
  end
end
local function near(got, want, slop, what)
  checks = checks + 1
  if math.abs(got - want) > slop then
    failures = failures + 1
    io.write("FAIL  ", what, "\n        got  ", tostring(got),
             "\n        want ", tostring(want), " +/- ", tostring(slop), "\n")
  end
end

local function index(list, name, get)
  for i, v in ipairs(list) do
    if (get and get(v) or v) == name then return i end
  end
  error("no such entry: " .. tostring(name))
end
local ROOT = function(n) return index(E.ROOTS, n, function(r) return r.name end) end
local SCL  = function(n) return index(E.SCALES, n, function(s) return s.name end) end
local RATE = function(n) return index(E.RATES, n, function(r) return r.name end) end
local BARS = function(n) return index(E.BAR_LENGTHS, n, function(b) return b.name end) end

------------------------------------------------------------------------------
-- A pen that writes down what it was asked for
------------------------------------------------------------------------------

local INK, STAFF, GROUND, ACCENT = 0xE8EBEFFF, 0x6E7683FF, 0x111419FF, 0xFFF200FF

local function recorder()
  local r = { lines = {}, polys = {}, circles = {}, texts = {}, all = {} }
  local function bounds(o) r.all[#r.all + 1] = o end
  r.pen = {
    line = function(x1, y1, x2, y2, col, th)
      for _, v in ipairs({ x1, y1, x2, y2 }) do
        if type(v) ~= "number" then error("a coordinate is a " .. type(v)) end
      end
      if type(col) ~= "number" then error("a line colour is a " .. type(col)) end
      local o = { x1 = x1, y1 = y1, x2 = x2, y2 = y2, col = col, th = th or 1 }
      r.lines[#r.lines + 1] = o
      bounds{ x1 = math.min(x1, x2), x2 = math.max(x1, x2),
              y1 = math.min(y1, y2), y2 = math.max(y1, y2), col = col }
    end,
    poly = function(pts, col)
      if #pts < 6 or #pts % 2 ~= 0 then error("a polygon has " .. #pts .. " coordinates") end
      local x1, y1, x2, y2 = math.huge, math.huge, -math.huge, -math.huge
      for i = 1, #pts - 1, 2 do
        x1, x2 = math.min(x1, pts[i]), math.max(x2, pts[i])
        y1, y2 = math.min(y1, pts[i + 1]), math.max(y2, pts[i + 1])
      end
      local o = { x1 = x1, y1 = y1, x2 = x2, y2 = y2, col = col,
                  cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 }
      r.polys[#r.polys + 1] = o
      bounds(o)
    end,
    circle = function(x, y, rad, col, filled)
      if type(rad) ~= "number" or rad <= 0 then error("a radius is " .. tostring(rad)) end
      local o = { x = x, y = y, r = rad, col = col, filled = filled }
      r.circles[#r.circles + 1] = o
      bounds{ x1 = x - rad, x2 = x + rad, y1 = y - rad, y2 = y + rad, col = col }
    end,
    text = function(x, y, col, str, size, center)
      if type(str) ~= "string" and type(str) ~= "number" then
        error("drawn text is a " .. type(str))
      end
      r.texts[#r.texts + 1] = { x = x, y = y, s = tostring(str), size = size }
      bounds{ x1 = x, x2 = x, y1 = y - (size or 10) / 2, y2 = y + (size or 10) / 2,
              col = col }
    end,
  }
  return r
end

local SP, X0, Y0 = 10, 40, 30
local COLS = { ink = INK, staff = STAFF, ground = GROUND, accent = ACCENT }

local function state(mut)
  local st = E.newState()
  st.barBeats = 4
  if mut then mut(st) end
  E.clampState(st)
  return st
end

local function layout(st, width)
  local block = E.generate(st)
  return N.layout(block, {
    barBeats = st.barBeats, ctx = N.context(E, st),
    drums = st.cat == "Drums", grid = N.gridFor(E, st),
    width = (width or 700) / SP,
  }), block
end

local function draw(st, width, opts)
  local doc = layout(st, width)
  local r = recorder()
  local h = D.page(r.pen, doc, X0, Y0, SP, COLS, opts)
  return r, doc, h
end

-- Where the first staff's lines are, worked out the same way D.page does it,
-- so a y can be turned back into a staff position.
local function firstStaff(doc)
  local above = select(1, D.margins(doc))
  local top = Y0 + 1.2 * SP + above * SP
  return {
    top = top,
    y = function(pos) return top + 4 * SP - pos * SP / 2 end,
    pos = function(y) return (top + 4 * SP - y) * 2 / SP end,
  }
end

------------------------------------------------------------------------------
-- Everything draws
------------------------------------------------------------------------------

do
  local bad, tried = nil, 0
  for _, cat in ipairs(E.CATEGORIES) do
    for _, rate in ipairs({ "1/16", "1/8", "1/4", "1/1" }) do
      for mod = 1, #E.RATE_MODS do
        for _, bars in ipairs({ "1/4", "1", "2" }) do
          local st = state(function(s)
            s.cat, s.rateMod, s.bars = cat, mod, BARS(bars)
            s.rate, s.chop, s.drumRate = RATE(rate), RATE(rate), rate
            s.lengthMode = "Bars"
          end)
          tried = tried + 1
          local got, err = pcall(draw, st)
          if not got then bad = bad or (cat .. " " .. rate .. " " .. bars .. ": " .. tostring(err)) end
        end
      end
    end
  end
  ok(tried > 200, "the sweep drew a real number of blocks (" .. tried .. ")")
  ok(bad == nil, "every block the panels can ask for draws: " .. tostring(bad))
end

-- Every root against every scale, since the key signature is drawn from tables
-- indexed by the signature's size and a seven-flat key is the end of them.
do
  local bad
  for r = 1, #E.ROOTS do
    for sc = 1, #E.SCALES do
      local st = state(function(s)
        s.root, s.scale = r, sc
        s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
      end)
      local got, err = pcall(draw, st)
      if not got then
        bad = bad or (E.ROOTS[r].name .. " " .. E.SCALES[sc].name .. ": " .. tostring(err))
      end
    end
  end
  ok(bad == nil, "every key draws its signature: " .. tostring(bad))
end

-- A block with nothing in it is still a page.
do
  local doc = N.layout({ notes = {}, beats = 4, name = "" }, { barBeats = 4, width = 70 })
  local r = recorder()
  local got, err = pcall(D.page, r.pen, doc, X0, Y0, SP, COLS)
  ok(got, "an empty block still draws: " .. tostring(err))
  ok(#r.lines > 0, "and it puts a staff on the page")
end

------------------------------------------------------------------------------
-- Nothing is drawn outside the room that was reserved
------------------------------------------------------------------------------

-- The window asks D.height how tall the page will be and reserves exactly
-- that. Anything drawn outside it is drawn over the buttons underneath, and a
-- beam over a high run or the figure over a tuplet is exactly what reaches
-- furthest from the staff - so this is checked against the blocks that go
-- highest and lowest rather than against a comfortable one.
do
  local cases = {
    { "a run up four octaves", function(s)
        s.cat = "Run"; s.rate = RATE("1/16"); s.octaves = 4
        s.lengthMode = "Bars"; s.bars = BARS("2") end },
    { "a bass line two octaves down", function(s)
        s.cat = "Bass"; s.bassOct = -2; s.rate = RATE("1/8") end },
    { "a thirteenth across the great staff", function(s)
        s.family = 5; s.chord = 30; s.oct = -1 end },
    { "triplets with the figure over them", function(s)
        s.cat = "Run"; s.rate = RATE("1/8"); s.rateMod = 2
        s.lengthMode = "Bars"; s.bars = BARS("1") end },
    { "the kit above the staff", function(s)
        s.cat = "Drums"; s.drumPiece = 5; s.drumRate = "1/8" end },
    { "four bars wrapped onto several systems", function(s)
        s.cat = "Run"; s.rate = RATE("1/8")
        s.lengthMode = "Bars"; s.bars = BARS("4") end },
  }
  for _, case in ipairs(cases) do
    local st = state(case[2])
    local r, doc, drawn = draw(st, 300)
    local promised = D.height(doc, SP)
    local top, bottom = math.huge, -math.huge
    for _, o in ipairs(r.all) do
      top, bottom = math.min(top, o.y1), math.max(bottom, o.y2)
    end
    ok(top >= Y0 - 1, case[1] .. ": nothing is drawn above the space reserved")
    ok(bottom <= Y0 + promised + 1,
       case[1] .. ": nothing is drawn below it (" ..
       ("%.1f past %.1f"):format(bottom - Y0, promised) .. ")")
    ok(drawn <= promised + 1, case[1] .. ": and it reports a height inside the promise")
  end
end

------------------------------------------------------------------------------
-- Where a note lands
------------------------------------------------------------------------------

-- Middle C on a treble staff is one ledger line below it. If the mapping from
-- pitch to staff position ever slips, it slips here first.
do
  local st = state(function(s) s.cat = "Melody"; s.interval = 8 end)   -- one held note
  local r, doc = draw(st)
  local s = firstStaff(doc)
  eq(doc.staves[1].clef, "treble", "a sustained tonic is on a treble staff")
  local head
  for _, p in ipairs(r.polys) do
    -- The noteheads are the wide filled shapes; the staff is lines.
    if p.x2 - p.x1 > SP * 0.8 and p.y2 - p.y1 > SP * 0.6 then head = head or p end
  end
  ok(head ~= nil, "a notehead was drawn")
  if head then
    near(s.pos(head.cy), -2, 0.35, "and middle C sits two half-spaces below the bottom line")
  end
end

-- A note outside the staff gets its ledger lines; one inside gets none. The
-- ledger is a short line at the note's own x, which is what tells it apart
-- from the staff's own lines running the width of the system.
do
  local function ledgersFor(mut)
    local st = state(mut)
    local r, doc = draw(st)
    -- A ledger line is horizontal, and it is the one horizontal mark that is
    -- about two spaces long: the staff's own lines run the width of the
    -- system, and the clef is drawn from strokes far shorter than this.
    local n = 0
    for _, l in ipairs(r.lines) do
      local w = math.abs(l.x2 - l.x1)
      if math.abs(l.y1 - l.y2) < 0.01 and w > 1.4 * SP and w < 2.2 * SP then
        n = n + 1
      end
    end
    return n, doc
  end
  local low = ledgersFor(function(s) s.cat = "Melody"; s.interval = 8 end)
  ok(low > 0, "middle C below a treble staff is given a ledger line")

  local inside = ledgersFor(function(s)
    s.cat = "Melody"; s.interval = 8; s.degree = 4; s.baseOct = 5
  end)
  eq(inside, 0, "and a note inside the staff is given none")
end

------------------------------------------------------------------------------
-- Stems and hooks
------------------------------------------------------------------------------

-- The stem is on the right of the head when it turns up and on the left when
-- it turns down (Sec. 1). Drawing it on the wrong side is the kind of thing
-- that looks almost right until a chord makes it obvious.
do
  local function stemSide(mut)
    local st = state(mut)
    local r, doc = draw(st)
    local els = {}
    for _, staff in ipairs(doc.measures[1].staves) do
      for _, el in ipairs(staff.elements) do
        if el.kind == "chord" and el.stem then els[#els + 1] = el end
      end
    end
    local el = els[1]
    if not el then return nil end
    -- The head's own x is the element's, and the stem was recorded on it.
    return el.stem, el.stemX - el.screenX
  end

  local dir, dx = stemSide(function(s)
    s.cat = "Melody"; s.interval = 8; s.degree = 0            -- low, so it turns up
  end)
  eq(dir, "up", "a low note turns its stem up")
  ok(dx and dx > 0, "and the stem is on the right of the head")

  local dir2, dx2 = stemSide(function(s)
    s.cat = "Melody"; s.interval = 8; s.baseOct = 6           -- high, so it turns down
  end)
  eq(dir2, "down", "a high note turns its stem down")
  ok(dx2 and dx2 < 0, "and the stem is on the left of the head")
end

-- A stem is an octave long, measured from the head at the far end of the
-- chord. Measuring from the near head instead makes a triad's stem half as
-- long again as it should be.
do
  local st = state(function(s) s.chop = RATE("1/4") end)     -- struck triads
  local r, doc = draw(st)
  local s = firstStaff(doc)
  local el
  for _, staff in ipairs(doc.measures[1].staves) do
    for _, e in ipairs(staff.elements) do
      if e.kind == "chord" and e.stem and not e.beam then el = el or e end
    end
  end
  ok(el ~= nil, "a stemmed chord was drawn")
  if el then
    local lo = el.heads[1].pos
    local want = (el.stem == "up") and (lo + 7) or (lo - 7)
    local tip = s.pos(el.stemTip)
    -- It may be longer than an octave to reach the middle line or to clear the
    -- chord's own top head, but it is never shorter.
    ok((el.stem == "up") and tip >= want - 0.2 or tip <= want + 0.2,
       "a chord's stem is at least an octave from its far head")
    ok(math.abs(tip - want) < 4,
       "and not wildly longer than one (" .. ("%.1f"):format(tip - want) .. ")")
  end
end

-- A beamed note has no hook of its own, and an unbeamed short one does. The
-- hook is always on the right of the stem, whichever way the stem turns.
do
  local st = state(function(s)
    s.cat = "Arpeggio"; s.rate = RATE("1/8"); s.lengthMode = "Repeats"; s.repeats = 1
  end)
  local r, doc = draw(st)
  local flagged = 0
  for _, staff in ipairs(doc.measures[1].staves) do
    for _, el in ipairs(staff.elements) do
      if el.kind == "chord" and N.hooks(el.value) > 0 and not el.beam then
        flagged = flagged + 1
        local right = 0
        for _, l in ipairs(r.lines) do
          if l.x1 > el.stemX - 0.1 and math.abs(l.y1 - el.stemTip) < 2 * SP then
            right = right + 1
          end
        end
        ok(right > 0, "an unbeamed eighth is given a hook, on the right of its stem")
      end
    end
  end
  ok(flagged > 0, "the block had an unbeamed eighth in it to check")
end

------------------------------------------------------------------------------
-- Beams
------------------------------------------------------------------------------

-- Every beam group puts a beam on the page, one per level: a sixteenth
-- carries two, and drawing only one is a whole class of wrong.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/16"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local r, doc = draw(st)
  -- A beam is a filled quadrilateral much wider than it is tall.
  local beams = 0
  for _, p in ipairs(r.polys) do
    if p.x2 - p.x1 > 1.4 * SP and p.y2 - p.y1 < 1.2 * SP then beams = beams + 1 end
  end
  ok(beams >= 8, "four groups of sixteenths draw two beams each (" .. beams .. ")")
end

-- Every stem in a beamed group reaches the same beam, so their tips lie on one
-- straight line.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local r, doc = draw(st)
  for _, staff in ipairs(doc.measures[1].staves) do
    local seen = {}
    for _, el in ipairs(staff.elements) do
      if el.beam and not seen[el.beam] then
        seen[el.beam] = true
        local run = el.beam
        if #run > 2 then
          local a, b, c = run[1], run[2], run[#run]
          local t = (b.stemX - a.stemX) / math.max(c.stemX - a.stemX, 1e-9)
          local want = a.beamTip + (c.beamTip - a.beamTip) * t
          near(b.beamTip, want, 0.6, "every stem in a group reaches the same straight beam")
        end
      end
    end
  end
end

-- A beam never stands on end. A rising scale in sixteenths is the shape that
-- settles this: at anything like the full interval the beams are unreadable.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/16"); s.octaves = 2
    s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local r, doc = draw(st)
  for _, staff in ipairs(doc.measures[1].staves) do
    local seen = {}
    for _, el in ipairs(staff.elements) do
      if el.beam and not seen[el.beam] then
        seen[el.beam] = true
        local run = el.beam
        local rise = math.abs(run[#run].beamTip - run[1].beamTip)
        ok(rise <= 1.25 * SP + 0.5,
           "a beam leans by at most a space and a bit (" ..
           ("%.2f"):format(rise / SP) .. " spaces)")
      end
    end
  end
end

------------------------------------------------------------------------------
-- Rests and dots
------------------------------------------------------------------------------

-- The whole rest hangs under the fourth line and the half rest sits on the
-- third, both occupying the third space (Sec. 5).
do
  local doc = N.layout({ notes = {}, beats = 4, name = "" }, { barBeats = 4, width = 70 })
  local r = recorder()
  D.page(r.pen, doc, X0, Y0, SP, COLS)
  local s = firstStaff(doc)
  local rect
  for _, p in ipairs(r.polys) do
    if p.x2 - p.x1 > 0.8 * SP and p.y2 - p.y1 < 0.8 * SP then rect = rect or p end
  end
  ok(rect ~= nil, "a measure rest was drawn")
  if rect then
    near(s.pos(rect.y1), 6, 0.3, "and it hangs from the fourth line")
    ok(rect.y2 > rect.y1, "downward into the third space")
  end
end

-- The dot after a note always appears on a space, whether the head is on a
-- line or on a space (Sec. 11).
do
  local st = state(function(s) s.chop = RATE("1/4"); s.rateMod = 3 end)
  local r, doc = draw(st)
  local s = firstStaff(doc)
  -- Only what is drawn inside the bar: the clefs put filled dots of their own
  -- on the page - the F clef's pair and the G clef's eye - and those are not
  -- dots after notes and do not follow this rule.
  local barStart = X0 + doc.headWidth * SP
  local dots = 0
  for _, c in ipairs(r.circles) do
    if c.filled and c.r < 0.25 * SP and c.x > barStart then
      local pos = s.pos(c.y)
      -- Only the dots after notes are this size and inside the staff's reach.
      if pos > -6 and pos < 14 then
        local off = math.abs(pos - math.floor(pos + 0.5))
        if off < 0.2 then
          dots = dots + 1
          ok(math.floor(pos + 0.5) % 2 ~= 0,
             "a dot after a note is on a space, not on a line (position " ..
             tostring(math.floor(pos + 0.5)) .. ")")
        end
      end
    end
  end
  ok(dots > 0, "the block had dotted notes to check (" .. dots .. ")")
end

------------------------------------------------------------------------------
-- The key signature
------------------------------------------------------------------------------

-- The accidentals of a signature are written in one fixed shape, and it is not
-- the same shape for sharps as for flats or for one clef as for the other.
-- Checked by counting them rather than by looking: six sharps is six.
do
  for _, row in ipairs({ { "F#", 6 }, { "Db", 5 }, { "Bb", 2 }, { "C", 0 } }) do
    local st = state(function(s)
      s.root = ROOT(row[1]); s.scale = SCL("Major")
      s.cat = "Melody"; s.interval = 8
    end)
    local r, doc = draw(st)
    eq(doc.sig.count, row[2], row[1] .. " major prints " .. row[2] .. " accidentals")
  end
end

------------------------------------------------------------------------------
-- The accent
------------------------------------------------------------------------------

-- The page is drawn in ink. The accent is spent on one thing only - the note
-- an audition is inside - so it must not appear at all when nothing is being
-- auditioned, and must appear when something is.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local r = draw(st)
  local accented = 0
  for _, o in ipairs(r.all) do
    if o.col == ACCENT then accented = accented + 1 end
  end
  eq(accented, 0, "nothing is drawn in the accent while nothing is playing")

  local r2, doc = draw(st, 700, {
    highlight = function(el) return el.abs == 0 end,
  })
  local hot = 0
  for _, o in ipairs(r2.all) do
    if o.col == ACCENT then hot = hot + 1 end
  end
  ok(hot > 0, "the note under the playhead takes the accent")

  local total = 0
  for _, o in ipairs(r2.all) do total = total + 1 end
  ok(hot < total / 4, "and only that one does, not the page (" ..
     hot .. " of " .. total .. ")")
end

------------------------------------------------------------------------------
-- The ground
------------------------------------------------------------------------------

-- An open notehead is opaque: the staff line it sits on stops at its edge
-- rather than running through the hole. That is drawn as a second, smaller
-- shape in the ground colour inside the first.
-- Both open heads are checked, because they are drawn by different branches:
-- a whole note is a wide oval with its own hole and a half note is the ordinary
-- head with a smaller one. Testing only the whole note leaves the half note's
-- hole free to disappear, which is exactly what happened the first time this
-- was checked.
do
  local st = state()                                   -- a whole-note triad
  local r = draw(st)
  local holes = 0
  for _, p in ipairs(r.polys) do
    if p.col == GROUND then holes = holes + 1 end
  end
  eq(holes, 3, "each of the three whole noteheads is punched with the ground")
end
do
  local st = state(function(s) s.chop = RATE("1/2") end)   -- half-note triads
  local r, doc = draw(st)
  local halves = 0
  for _, staff in ipairs(doc.measures[1].staves) do
    for _, el in ipairs(staff.elements) do
      if el.kind == "chord" and el.value.den == 2 then halves = halves + 1 end
    end
  end
  ok(halves > 0, "the block was written in half notes (" .. halves .. ")")
  local holes = 0
  for _, p in ipairs(r.polys) do
    if p.col == GROUND then holes = holes + 1 end
  end
  eq(holes, halves * 3, "and every half notehead is punched too")
end
do
  local st = state(function(s) s.chop = RATE("1/8") end)   -- filled heads
  local r = draw(st)
  local holes = 0
  for _, p in ipairs(r.polys) do
    if p.col == GROUND then holes = holes + 1 end
  end
  eq(holes, 0, "and a filled notehead is not punched at all")
end

------------------------------------------------------------------------------

io.write(("%d checks, %d failures\n"):format(checks, failures))
os.exit(failures == 0 and 0 or 1)
