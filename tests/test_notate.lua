--[[ The engraver, by running it.

     `sb_notate.lua` is pure, so every question about the page can be asked
     here rather than looked at: which signature a scale prints in, how a
     duration is written, where a beam breaks, which way a stem turns, whether
     an accidental is shown or held over from earlier in the bar.

     The conventions checked are Gehrkens, *Music Notation and Terminology*,
     by section, the same ones the module cites.

       lua5.4 tests/test_notate.lua
       python3 tools/run_lua.py tests/test_notate.lua
]]

local HERE = (arg and arg[0] or ""):match("^(.*)[/\\]") or "."
local E = dofile(HERE .. "/../reascripts/sb_engine.lua")
local N = dofile(HERE .. "/../reascripts/sb_notate.lua")

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

local function state(mut)
  local st = E.newState()
  st.barBeats = 4
  if mut then mut(st) end
  E.clampState(st)
  return st
end

local function lay(st, width)
  local block = E.generate(st)
  local doc = N.layout(block, {
    barBeats = st.barBeats, ctx = N.context(E, st),
    drums = st.cat == "Drums", grid = N.gridFor(E, st),
    width = width or 90,
  })
  return doc, block
end

-- Every element of a measure, both staves, in order.
local function elements(m)
  local out = {}
  for _, staff in ipairs(m.staves) do
    for _, el in ipairs(staff.elements) do out[#out + 1] = el end
  end
  table.sort(out, function(a, b) return a.at < b.at end)
  return out
end

------------------------------------------------------------------------------
-- Key signatures
------------------------------------------------------------------------------

-- The ones a lookup table would have got right. If the scoring in
-- `chooseSignature` ever stops agreeing with these, it has stopped being a
-- better answer than the table it replaced.
local SIGNATURES = {
  { "C",  "Major",      0, "sharp" },
  { "G",  "Major",      1, "sharp" },
  { "D",  "Major",      2, "sharp" },
  { "A",  "Major",      3, "sharp" },
  { "E",  "Major",      4, "sharp" },
  { "B",  "Major",      5, "sharp" },
  { "F#", "Major",      6, "sharp" },
  { "F",  "Major",      1, "flat"  },
  { "Bb", "Major",      2, "flat"  },
  { "Eb", "Major",      3, "flat"  },
  { "Ab", "Major",      4, "flat"  },
  { "Db", "Major",      5, "flat"  },
  { "Gb", "Major",      6, "flat"  },
  { "A",  "Minor",      0, "sharp" },
  { "E",  "Minor",      1, "sharp" },
  { "D",  "Minor",      1, "flat"  },
  { "C",  "Minor",      3, "flat"  },
  { "F#", "Minor",      3, "sharp" },
}
for _, row in ipairs(SIGNATURES) do
  local st = state(function(s) s.root = ROOT(row[1]); s.scale = SCL(row[2]) end)
  local sig = N.context(E, st).sig
  local got = sig.count .. " " .. (sig.count == 0 and "sharp" or sig.kind)
  eq(got, row[3] .. " " .. (row[3] == 0 and "sharp" or row[4]),
     row[1] .. " " .. row[2] .. " prints the right key signature")
end

-- Harmonic minor is the case a table cannot hold: it is written in the natural
-- minor's signature and its raised seventh is an accidental, in every edition
-- ever printed. The signature it picks has to be the plain minor's.
do
  local st = state(function(s) s.root = ROOT("A"); s.scale = SCL("Harm Minor") end)
  eq(N.context(E, st).sig.count, 0, "A harmonic minor prints no key signature")
end

-- And the diminished scales spell two of their notes on one letter, so no
-- signature can hold them either. What matters is that one is still chosen and
-- the page is not left in a broken state.
for _, name in ipairs({ "Dim W-H", "Dim H-W", "Whole Tone", "Maj Blues", "Min Blues" }) do
  local st = state(function(s) s.scale = SCL(name) end)
  local sig = N.context(E, st).sig
  ok(sig.count >= 0 and sig.count <= 7,
     name .. " still chooses a signature it can print")
end

-- Every root against every scale, because a signature is chosen for all of
-- them and an index off the end of the order table would only show up here.
do
  local bad
  for r = 1, #E.ROOTS do
    for sc = 1, #E.SCALES do
      local st = state(function(s) s.root = r; s.scale = sc end)
      local c = N.context(E, st)
      if c.sig.count < 0 or c.sig.count > 7 or not c.sigMap[0] == nil then
        bad = E.ROOTS[r].name .. " " .. E.SCALES[sc].name
      end
      for i = 0, 6 do
        if c.sigMap[i] == nil then bad = E.ROOTS[r].name .. " " .. E.SCALES[sc].name end
      end
    end
  end
  ok(bad == nil, "every root and scale gets a printable signature: " .. tostring(bad))
end

------------------------------------------------------------------------------
-- Spelling
------------------------------------------------------------------------------

do
  local st  = state()
  local ctx = N.context(E, st)
  eq(N.spell(60, ctx).step, N.MIDDLE_C, "middle C is the step the staves count from")
  eq(N.stepName(N.spell(60, ctx).step), "C4", "and it is called C4")
  eq(N.stepName(N.spell(69, ctx).step), "A4", "A440 is A4")
  eq(N.stepName(N.spell(59, ctx).step), "B3", "the B below middle C is B3")
end

-- The written octave follows the letter, not the sounding pitch. Cb4 sounds a
-- B and is written on the C of the fourth octave; B#3 sounds a middle C and is
-- written a degree below it. Getting this wrong files a note an octave out
-- while every name still reads correctly, which is why it is asserted directly.
do
  local ctx = { spell = { [11] = { letter = 0, acc = -1 } },   -- Cb
                sig = { count = 7, kind = "flat" } }
  eq(N.stepName(N.spell(59, ctx).step), "C4", "Cb4 is written on C4, not B3")
end
do
  local ctx = { spell = { [0] = { letter = 6, acc = 1 } },     -- B#
                sig = { count = 7, kind = "sharp" } }
  eq(N.stepName(N.spell(60, ctx).step), "B3", "B#3 is written on B3, not C4")
end

-- F# major spells its seventh E#, here as it does everywhere else in the app.
do
  local st  = state(function(s) s.root = ROOT("F#"); s.scale = SCL("Major") end)
  local ctx = N.context(E, st)
  local pitch = E.scalePitch(st, 6)
  eq(N.stepName(N.spell(pitch, ctx).step):sub(1, 1), "E",
     "the seventh of F# major is written on E, not F")
  eq(N.spell(pitch, ctx).acc, 1, "and it is sharpened")
end

-- A note the scale has no spelling for falls back to the side the signature
-- leans, so a flat key does not sprout sharps.
do
  local st  = state(function(s) s.root = ROOT("Db"); s.scale = SCL("Major") end)
  local ctx = N.context(E, st)
  local bad
  for p = 60, 71 do
    if N.spell(p, ctx).acc > 0 then bad = p end
  end
  ok(bad == nil, "a five-flat key spells its chromatic notes flat: " .. tostring(bad))
end

------------------------------------------------------------------------------
-- Note values
------------------------------------------------------------------------------

do
  local T = N.TPQ
  local function v(ticks) return N.value(ticks) end
  eq(v(4 * T).den, 1, "four beats is a whole note")
  eq(v(2 * T).den, 2, "two beats is a half note")
  eq(v(T).den, 4, "a beat is a quarter note")
  eq(v(T / 2).den, 8, "half a beat is an eighth")
  eq(v(T / 4).den, 16, "a quarter of one is a sixteenth")
  eq(v(3 * T / 2).den, 4, "a beat and a half is a quarter")
  eq(v(3 * T / 2).dots, 1, "with a dot on it")
  eq(v(2 * T / 3).den, 4, "two thirds of a beat is a quarter")
  eq(v(2 * T / 3).tuplet, 3, "in a triplet")
  eq(v(T / 3).den, 8, "a third of a beat is an eighth")
  eq(v(T / 3).tuplet, 3, "in a triplet")

  eq(N.hooks({ den = 4, dots = 0 }), 0, "a quarter note carries no hook")
  eq(N.hooks({ den = 8, dots = 0 }), 1, "an eighth carries one")
  eq(N.hooks({ den = 16, dots = 0 }), 2, "a sixteenth carries two")
  eq(N.hooks({ den = 32, dots = 0 }), 3, "a thirty-second carries three")

  -- A dotted triplet is a real thing and nothing here can generate one, so it
  -- is kept out of the set: leaving it in let the fallback reach for a
  -- double-dotted triplet sixteenth where a plain sixteenth belonged.
  local dottedTriplet = false
  for _, val in ipairs(N.VALUES) do
    if val.tuplet and val.dots > 0 then dottedTriplet = true end
  end
  ok(not dottedTriplet, "no value in the set is both dotted and a triplet")
end

-- A duration with a symbol of its own is written with that symbol wherever it
-- falls. A half note on the second beat of a three-four bar is a half note,
-- and a rule that split it at the beat would be wrong about printed music.
do
  local T, bar = N.TPQ, N.TPQ * 3
  local pieces = N.split(T, 2 * T, bar)
  eq(#pieces, 1, "a half note on beat two of three-four stays one note")
  eq(pieces[1].den, 2, "and it is a half note")
end

do
  local T = N.TPQ
  local pieces = N.split(0, 4 * T, 4 * T)
  eq(#pieces, 1, "a whole bar of four-four is one whole note")
  eq(pieces[1].den, 1, "and it is a whole note")
end

-- A duration with no symbol comes back as a tie chain that adds up exactly.
do
  local T = N.TPQ
  local want = T + T / 4                      -- five sixteenths
  local pieces = N.split(0, want, 4 * T)
  local sum = 0
  for _, v in ipairs(pieces) do sum = sum + v.ticks end
  eq(sum, want, "five sixteenths are written as values that add up to five")
  ok(#pieces >= 2, "and it takes more than one of them")
end

------------------------------------------------------------------------------
-- What a block comes out as
------------------------------------------------------------------------------

-- The gate is the thing most likely to be notated literally by accident. Every
-- block leaves the engine shortened so the player hears the change, and a
-- chord filling a bar has to be a whole note on the page all the same.
do
  local doc = lay(state())
  local els = elements(doc.measures[1])
  eq(#els, 1, "a triad filling a bar is one event")
  eq(els[1].value.den, 1, "written as a whole note, not as a gated something")
  eq(els[1].ticks, 4 * N.TPQ, "lasting the whole bar")
  eq(#els[1].heads, 3, "with three heads on it")
end

-- Nothing is lost and nothing is invented: every measure of every block adds
-- up to what the block actually filled. This is the invariant that catches a
-- split, a tie or a rest going wrong anywhere in the pipeline, for any block
-- the panels can ask for.
do
  local bad, tried = nil, 0
  for _, cat in ipairs(E.CATEGORIES) do
    for _, rate in ipairs({ "1/16", "1/8", "1/4", "1/2" }) do
      for mod = 1, #E.RATE_MODS do
        for _, bars in ipairs({ "1/2", "1", "2" }) do
          local st = state(function(s)
            s.cat, s.rateMod, s.bars = cat, mod, BARS(bars)
            s.rate, s.chop = RATE(rate), RATE(rate)
            s.drumRate = rate
            s.lengthMode = "Bars"
          end)
          local doc = lay(st)
          tried = tried + 1
          for _, m in ipairs(doc.measures) do
            for si, staff in ipairs(m.staves) do
              local sum = 0
              for _, el in ipairs(staff.elements) do sum = sum + el.ticks end
              -- A staff holds either the whole measure or nothing at all: on a
              -- great staff a voice can be absent from one of the two.
              if sum ~= m.used and sum ~= 0 then
                bad = bad or (cat .. " " .. rate .. " mod" .. mod .. " " .. bars ..
                              " measure " .. m.index .. " staff " .. si ..
                              ": " .. sum .. " of " .. m.used)
              end
            end
          end
        end
      end
    end
  end
  ok(tried > 200, "the sweep covered a real number of blocks (" .. tried .. ")")
  ok(bad == nil, "every measure of every block is filled exactly: " .. tostring(bad))
end

-- A note crossing a bar line becomes two notes and a tie (Sec. 25), and the
-- tie is marked at both ends rather than only at one.
do
  local st = state(function(s)
    s.chop = RATE("1/4"); s.rateMod = 3; s.bars = BARS("2")    -- dotted quarters
  end)
  local doc = lay(st)
  local out, into = 0, 0
  for _, m in ipairs(doc.measures) do
    local els = elements(m)
    for i, el in ipairs(els) do
      if el.tieOut then
        out = out + 1
        ok(i == #els, "a tie out of a measure is its last event")
      end
      if el.tieIn then
        into = into + 1
        ok(i == 1, "and a tie into one is its first")
      end
    end
  end
  ok(out > 0, "dotted quarters across four-four tie across the bar")
  eq(out, into, "and every tie out has a tie in to meet it")
end

-- A bar with nothing in it is one whole rest, whatever the signature says
-- (Sec. 33).
do
  local doc = N.layout({ notes = {}, beats = 8, name = "" },
                       { barBeats = 4, width = 90 })
  for _, m in ipairs(doc.measures) do
    local els = elements(m)
    eq(#els, 1, "an empty measure holds one thing")
    eq(els[1].kind, "rest", "and it is a rest")
    ok(els[1].measureRest, "written as the measure rest")
  end
end

------------------------------------------------------------------------------
-- Beams and stems
------------------------------------------------------------------------------

-- Eighths and shorter are gathered inside one beat, and the beat is where a
-- group ends (Sec. 4). Sixteen sixteenths in four-four are four groups of
-- four, not one group of sixteen.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/16"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  local groups, sizes = {}, {}
  for _, el in ipairs(elements(doc.measures[1])) do
    if el.beam and not groups[el.beam] then
      groups[el.beam] = true
      sizes[#sizes + 1] = #el.beam
    end
  end
  eq(#sizes, 4, "a bar of sixteenths is beamed into four groups")
  for _, n in ipairs(sizes) do eq(n, 4, "each of four notes") end
end

-- A quarter note carries no beam and ends whatever group it interrupts.
do
  local st = state(function(s)
    s.cat = "Arpeggio"; s.rate = RATE("1/4"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  for _, el in ipairs(elements(doc.measures[1])) do
    if el.kind == "chord" then
      ok(el.beam == nil, "a quarter note is not in a beam group")
    end
  end
end

-- Below the middle line the stem turns up, above it turns down (Sec. 2).
do
  local function stemFor(pos)
    local els = { { kind = "chord", at = 0, ticks = 960,
                    value = { den = 4, dots = 0 }, heads = { { pos = pos } } } }
    N.stems(els, false)
    return els[1].stem
  end
  for pos = 0, 3 do eq(stemFor(pos), "up", "a head below the middle line turns its stem up") end
  for pos = 5, 8 do eq(stemFor(pos), "down", "a head above it turns its stem down") end
  ok(stemFor(4) == "up" or stemFor(4) == "down",
     "and a head on the middle line turns one way or the other")
end

-- A chord is decided by whichever head is furthest from the middle line.
do
  local function stemFor(a, b)
    local els = { { kind = "chord", at = 0, ticks = 960,
                    value = { den = 4, dots = 0 },
                    heads = { { pos = a }, { pos = b } } } }
    N.stems(els, false)
    return els[1].stem
  end
  eq(stemFor(-2, 2), "up", "a chord hanging below the middle line turns its stem up")
  eq(stemFor(6, 12), "down", "and one sitting above it turns its stem down")
  eq(stemFor(-4, 6), "up", "the head furthest from the middle line decides")
end

-- A beamed group turns every stem the same way, and the way the majority of
-- its heads asks for (Sec. 4).
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  local seen = {}
  for _, el in ipairs(elements(doc.measures[1])) do
    if el.beam then
      seen[el.beam] = seen[el.beam] or el.stem
      eq(el.stem, seen[el.beam], "every stem in a beam group turns the same way")
      eq(el.stem, el.beam.stem, "and it is the group's own direction")
    end
  end
end

-- A whole note has no stem at all.
do
  local doc = lay(state())
  eq(elements(doc.measures[1])[1].stem, nil, "a whole note has no stem")
end

------------------------------------------------------------------------------
-- Tuplets
------------------------------------------------------------------------------

-- Beamed triplets need only the figure; three triplet quarters have no beam to
-- carry it, so those get the bracket as well.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/8"); s.rateMod = 2
    s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  local any = false
  for _, staff in ipairs(doc.measures[1].staves) do
    for _, g in ipairs(staff.tuplets or {}) do
      any = true
      eq(g.n, 3, "a triplet group is three")
      ok(not g.bracket, "and a beamed one needs no bracket")
    end
  end
  ok(any, "triplet eighths are grouped as triplets")
end
do
  local st = state(function(s)
    s.cat = "Arpeggio"; s.rate = RATE("1/4"); s.rateMod = 2
    s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  local any = false
  for _, staff in ipairs(doc.measures[1].staves) do
    for _, g in ipairs(staff.tuplets or {}) do
      any = true
      ok(g.bracket, "an unbeamed triplet gets the bracket")
    end
  end
  ok(any, "triplet quarters are grouped as triplets")
end

------------------------------------------------------------------------------
-- Accidentals
------------------------------------------------------------------------------

-- An accidental is shown where it changes what the degree is sounding, and
-- then held until the bar line (Sec. 24). A run of harmonic minor marks its
-- raised seventh the first time and not the second.
do
  local st = state(function(s)
    s.root = ROOT("A"); s.scale = SCL("Harm Minor")
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
    s.octaves = 2
  end)
  local doc = lay(st)
  for _, m in ipairs(doc.measures) do
    local byStep, shown = {}, {}
    for _, el in ipairs(elements(m)) do
      for _, h in ipairs(el.heads or {}) do
        if h.acc then
          ok(not shown[h.step], "an accidental is not written twice on one degree in a bar")
          shown[h.step] = true
        end
        byStep[h.step] = true
      end
    end
  end
  -- And it really is written at least once.
  local marked = 0
  for _, el in ipairs(elements(doc.measures[1])) do
    for _, h in ipairs(el.heads or {}) do
      if h.acc == 1 then marked = marked + 1 end
    end
  end
  ok(marked > 0, "the raised seventh of harmonic minor is marked with a sharp")
end

-- What the signature already says is not said again. A scale written in its
-- own key wears no accidentals at all - and this is the assertion that bites:
-- the "not twice in a bar" check above passes happily on a version that marks
-- every single note, because a run rarely repeats a degree inside one bar.
for _, row in ipairs({ { "C", "Major" }, { "Db", "Major" }, { "F#", "Major" },
                       { "Bb", "Major" }, { "A", "Minor" }, { "E", "Minor" } }) do
  local st = state(function(s)
    s.root = ROOT(row[1]); s.scale = SCL(row[2])
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
    s.octaves = 2
  end)
  local doc = lay(st)
  local marked = 0
  for _, m in ipairs(doc.measures) do
    for _, el in ipairs(elements(m)) do
      for _, h in ipairs(el.heads or {}) do
        if h.acc then marked = marked + 1 end
      end
    end
  end
  eq(marked, 0, row[1] .. " " .. row[2] ..
     " writes its own scale with no accidentals - the signature has said it")
end

-- And in harmonic minor exactly one degree is marked, because exactly one is
-- not in the signature.
do
  local st = state(function(s)
    s.root = ROOT("A"); s.scale = SCL("Harm Minor")
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
    s.octaves = 2
  end)
  local doc = lay(st)
  local letters = {}
  for _, m in ipairs(doc.measures) do
    for _, el in ipairs(elements(m)) do
      for _, h in ipairs(el.heads or {}) do
        if h.acc then letters[N.stepName(h.step):sub(1, 1)] = true end
      end
    end
  end
  local names = {}
  for k in pairs(letters) do names[#names + 1] = k end
  table.sort(names)
  eq(table.concat(names, ","), "G",
     "A harmonic minor marks its seventh and nothing else")
end

-- A degree that does repeat inside a bar is marked once and then left alone.
do
  local st = state(function(s)
    s.root = ROOT("A"); s.scale = SCL("Harm Minor"); s.degree = 6
    s.cat = "Arpeggio"; s.rate = RATE("1/16")
    s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  for _, m in ipairs(doc.measures) do
    local shown = {}
    for _, el in ipairs(elements(m)) do
      for _, h in ipairs(el.heads or {}) do
        if h.acc then
          ok(not shown[h.step],
             "a repeated degree is marked once in the bar, not on every pass")
          shown[h.step] = true
        end
      end
    end
  end
end

-- A natural cancels a flatted degree (Sec. 26, rule 3). The diminished scale
-- spells two of its notes on one letter, which is exactly that case.
do
  local st = state(function(s)
    s.scale = SCL("Dim W-H"); s.cat = "Run"; s.rate = RATE("1/8")
    s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  local naturals, flats = 0, 0
  for _, m in ipairs(doc.measures) do
    for _, el in ipairs(elements(m)) do
      for _, h in ipairs(el.heads or {}) do
        if h.acc == 0 then naturals = naturals + 1 end
        if h.acc == -1 then flats = flats + 1 end
      end
    end
  end
  ok(flats > 0, "the diminished scale writes flats")
  ok(naturals > 0, "and a natural where one of those letters comes back")
end

-- A note tied from the previous measure does not ask for its accidental again:
-- the tie carries it (Sec. 25).
do
  local st = state(function(s)
    s.root = ROOT("Db"); s.chop = RATE("1/4"); s.rateMod = 3; s.bars = BARS("2")
  end)
  local doc = lay(st)
  for _, m in ipairs(doc.measures) do
    for _, el in ipairs(elements(m)) do
      if el.tieIn then
        for _, h in ipairs(el.heads or {}) do
          ok(h.acc == nil, "a tied-in note is not given its accidental again")
        end
      end
    end
  end
end

------------------------------------------------------------------------------
-- Heads and accidentals
------------------------------------------------------------------------------

-- Half the height of an accidental and of a notehead, in staff degrees. A
-- sharp stands about two and a half spaces tall, a head one.
local ACC_HALF, HEAD_HALF = 2.5, 1.0

-- Where each head's ink actually is, in spaces either side of the element's x.
local function headSpan(el, h)
  local rx = (el.value.den <= 1) and N.WHOLE_RX or N.HEAD_RX
  local cx = (h.side == 1) and (el.sideDir * 2 * rx) or 0
  return cx - rx, cx + rx
end

local function accSpan(h)
  local w = N.ACC_WIDTHS[h.acc]
  return h.accDX - w / 2, h.accDX + w / 2
end

-- **No accidental may sit on top of a notehead.** This is the one that was
-- missing: a six-nine chord is written as a whole note, a whole note has no
-- stem, and the head crossed to the other side of the stem was sent one way by
-- the layout and drawn the other way, straight onto its own sharp.
do
  local bad, checked = nil, 0
  for _, root in ipairs({ "C", "F#", "Db", "A", "Eb" }) do
    for _, scale in ipairs({ "Major", "Minor", "Harm Minor", "Dim W-H" }) do
      for _, fam in ipairs(E.FAMILIES) do
        for _, chop in ipairs({ "1/1", "1/4" }) do    -- stemless, then stemmed
          for deg = 0, 4 do
            for ch = 1, #E.CHORDS, 7 do
              local st = state(function(s)
                s.root, s.scale, s.degree = ROOT(root), SCL(scale), deg
                s.family = index(E.FAMILIES, fam)
                s.chord, s.chop = ch, RATE(chop)
              end)
              local doc = lay(st)
              for _, m in ipairs(doc.measures) do
                for _, el in ipairs(elements(m)) do
                  if el.kind == "chord" then
                    for _, h in ipairs(el.heads) do
                      if h.acc then
                        checked = checked + 1
                        local aL, aR = accSpan(h)
                        for _, g in ipairs(el.heads) do
                          local gL = select(1, headSpan(el, g))
                          -- Only a head the accidental could actually reach.
                          if math.abs(h.pos - g.pos) < ACC_HALF + HEAD_HALF
                             and aR > gL + 1e-6 then
                            bad = bad or ("%s %s deg%d chord%d: the %s on %s runs to %.2f, " ..
                              "and a head starts at %.2f"):format(root, scale, deg, ch,
                              (h.acc > 0 and "sharp" or "flat"), h.name or "?", aR, gL)
                          end
                        end
                      end
                    end
                  end
                end
              end
            end
          end
        end
      end
    end
  end
  ok(checked > 200, "the sweep found a real number of accidentals (" .. checked .. ")")
  ok(bad == nil, "no accidental is drawn on top of a notehead: " .. tostring(bad))
end

-- Two accidentals must not sit on top of each other either: near neighbours go
-- into separate columns, and distant ones share one rather than marching off
-- to the left.
do
  local bad, pairs2 = nil, 0
  for _, deg in ipairs({ 0, 1, 4, 5 }) do
    for ch = 1, #E.CHORDS do
      local st = state(function(s)
        s.root, s.scale, s.degree = ROOT("Db"), SCL("Harm Minor"), deg
        s.family = index(E.FAMILIES, "Extended")
        s.chord = ch
      end)
      local doc = lay(st)
      for _, m in ipairs(doc.measures) do
        for _, el in ipairs(elements(m)) do
          if el.kind == "chord" then
            for i, h in ipairs(el.heads) do
              for j = i + 1, #el.heads do
                local g = el.heads[j]
                if h.acc and g.acc then
                  pairs2 = pairs2 + 1
                  local hL, hR = accSpan(h)
                  local gL, gR = accSpan(g)
                  local overlapX = hR > gL + 1e-6 and gR > hL + 1e-6
                  local overlapY = math.abs(h.pos - g.pos) < 2 * ACC_HALF
                  if overlapX and overlapY then
                    bad = bad or ("deg%d chord%d: two accidentals overlap"):format(deg, ch)
                  end
                end
              end
            end
          end
        end
      end
    end
  end
  ok(pairs2 > 20, "the sweep found chords with more than one accidental (" .. pairs2 .. ")")
  ok(bad == nil, "no two accidentals overlap each other: " .. tostring(bad))
end

-- A whole note has no stem, and a crossed head still has to go somewhere. It
-- goes right, and **both modules are told so by the same field** - this is the
-- disagreement that caused the bug above, so it is asserted directly.
do
  local st = state(function(s)
    s.degree = 5; s.family = index(E.FAMILIES, "Extended"); s.chord = 9
  end)
  local doc = lay(st)
  local el = elements(doc.measures[1])[1]
  eq(el.stem, nil, "a whole-note chord has no stem")
  eq(el.sideDir, 1, "and its crossed head goes to the right")
  local crossed = 0
  for _, h in ipairs(el.heads) do if h.side == 1 then crossed = crossed + 1 end end
  eq(crossed, 1, "the six-nine chord has one head crossed over")
end
do
  local st = state(function(s)
    s.degree = 5; s.family = index(E.FAMILIES, "Extended"); s.chord = 9
    s.chop = RATE("1/4")
    s.oct = 1                                  -- high enough for a downward stem
  end)
  local doc = lay(st)
  for _, el in ipairs(elements(doc.measures[1])) do
    if el.kind == "chord" and el.stem == "down" then
      eq(el.sideDir, -1, "a downward stem sends its crossed head to the left")
      -- And the accidentals then clear it, which is the whole point.
      for _, h in ipairs(el.heads) do
        if h.acc then
          local aR = select(2, accSpan(h))
          local far = select(1, headSpan(el, el.heads[1]))
          for _, g in ipairs(el.heads) do
            far = math.min(far, (select(1, headSpan(el, g))))
          end
          ok(aR <= far + 1e-6,
             "and the accidentals move out to clear it")
        end
      end
    end
  end
end

-- Seconds are what make a head cross the stem at all.
do
  local function crossed(positions)
    local heads = {}
    for i, p in ipairs(positions) do heads[i] = { pos = p } end
    local el = { kind = "chord", value = { den = 4, dots = 0 },
                 heads = heads, stem = "up" }
    N.placeHeads({ el })
    local out = {}
    for i, h in ipairs(el.heads) do out[i] = h.side end
    return table.concat(out, "")
  end
  eq(crossed({ 0, 2, 4 }), "000", "a chord in thirds needs no head crossed over")
  eq(crossed({ 0, 1 }), "01", "a second crosses its upper head")
  eq(crossed({ 0, 1, 2 }), "010", "a cluster of three crosses only the middle one")
  eq(crossed({ 0, 1, 2, 3 }), "0101", "and a cluster of four alternates")
end

------------------------------------------------------------------------------
-- Staves
------------------------------------------------------------------------------

do
  local doc = lay(state())
  eq(#doc.staves, 1, "a block that stays above middle C gets one staff")
  eq(doc.staves[1].clef, "treble", "and it is a treble staff")
end
do
  local st = state(function(s) s.cat = "Bass"; s.bassOct = -2 end)
  local doc = lay(st)
  eq(#doc.staves, 1, "a bass line well below middle C gets one staff")
  eq(doc.staves[1].clef, "bass", "and it is a bass staff")
end
do
  local st = state(function(s) s.family = 5; s.chord = 30; s.oct = -1 end)
  local doc = lay(st)
  eq(#doc.staves, 2, "a chord straddling middle C gets the great staff")
  eq(doc.staves[1].clef, "treble", "treble on top")
  eq(doc.staves[2].clef, "bass", "bass underneath")
end
do
  local st = state(function(s) s.cat = "Drums" end)
  local doc = lay(st)
  eq(doc.staves[1].clef, "perc", "the kit is written under the neutral clef")
end

-- A run is not allowed to hop staves in the middle of itself: the choice is
-- made once for the block.
do
  local bad
  for _, cat in ipairs(E.CATEGORIES) do
    local st = state(function(s) s.cat = cat end)
    local doc = lay(st)
    if #doc.staves > 2 then bad = cat end
  end
  ok(bad == nil, "no block asks for more than two staves: " .. tostring(bad))
end

------------------------------------------------------------------------------
-- The kit
------------------------------------------------------------------------------

do
  for _, piece in ipairs(E.DRUM_PIECES) do
    ok(N.DRUM_MAP[piece.note] ~= nil,
       piece.name .. " has somewhere to be written on the staff")
  end
end

-- A drum does not sustain, so a single crash in a long block is a hit and then
-- silence rather than bars of tied whole notes.
do
  local st = state(function(s)
    s.cat = "Drums"; s.drumPiece = 5; s.drumRate = "1/1"; s.bars = BARS("2")
  end)
  local doc = lay(st)
  for _, m in ipairs(doc.measures) do
    for _, el in ipairs(elements(m)) do
      ok(el.ticks <= 4 * N.TPQ, "no drum hit is written longer than a bar")
      ok(not el.tieOut, "and none of them is tied into the next bar")
    end
  end
end

-- A shuffle pushes every second hit off the grid on purpose. Notation writes a
-- shuffle straight and names it at the top, which is what the block's own name
-- already does, so the onsets go back on the grid and the values stay plain.
do
  local st = state(function(s)
    s.cat = "Drums"; s.drumPiece = 1; s.drumRate = "1/16"; s.shuffle = 60
  end)
  local doc, block = lay(st)
  ok(block.name:match("shuffle"), "the block still says it is shuffled")
  local els = elements(doc.measures[1])
  eq(#els, 16, "a shuffled bar of sixteenths is sixteen notes")
  for _, el in ipairs(els) do
    eq(el.value.den, 16, "each one written as a sixteenth")
    eq(el.value.dots, 0, "with no dot on it")
    eq(el.value.tuplet, nil, "and not as a triplet")
  end
end

------------------------------------------------------------------------------
-- Spacing and systems
------------------------------------------------------------------------------

do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  local last = -1
  for _, el in ipairs(elements(doc.measures[1])) do
    ok(el.x > last, "each onset is further right than the one before it")
    last = el.x
  end
  ok(doc.measures[1].width > 0, "and the measure has a width")
end

-- An onset wearing an accidental opens the column far enough to the left to
-- hold it, or the sharp would be drawn over the note before.
do
  local st = state(function(s)
    s.root = ROOT("A"); s.scale = SCL("Harm Minor")
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st)
  local els = elements(doc.measures[1])
  for i, el in ipairs(els) do
    local wears = false
    for _, h in ipairs(el.heads or {}) do if h.acc then wears = true end end
    if wears and i > 1 then
      ok(el.x - els[i - 1].x > N.MIN_GAP,
         "a note with an accidental is given more room than one without")
    end
  end
end

-- Measures run across the page until they run out of room and then start a new
-- system. A narrow page wraps; a wide one does not.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("4")
  end)
  local wide = lay(st, 400)
  local narrow = lay(st, 30)
  eq(#wide.systems, 1, "four bars fit on one system when there is room")
  ok(#narrow.systems > 1, "and wrap onto more when there is not")
  local total = 0
  for _, sys in ipairs(narrow.systems) do total = total + #sys end
  eq(total, #narrow.measures, "and no measure is lost in the wrapping")
end

-- A measure wider than a whole system still gets drawn rather than dropped.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/32"); s.lengthMode = "Bars"; s.bars = BARS("1")
  end)
  local doc = lay(st, 12)
  ok(#doc.systems >= 1, "an over-wide measure is still given a system")
  local total = 0
  for _, sys in ipairs(doc.systems) do total = total + #sys end
  eq(total, #doc.measures, "and it is not dropped")
end

-- Where each element falls in the block as a whole, so a playhead can find the
-- note it is inside without searching for it.
do
  local st = state(function(s)
    s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = "Bars"; s.bars = BARS("2")
  end)
  local doc = lay(st)
  eq(doc.totalTicks > 0, true, "the document knows how long the block is")
  for _, m in ipairs(doc.measures) do
    for _, el in ipairs(elements(m)) do
      eq(el.abs, (m.index - 1) * m.ticks + el.at,
         "every element knows where it falls in the whole block")
    end
  end
end

------------------------------------------------------------------------------

io.write(("%d checks, %d failures\n"):format(checks, failures))
os.exit(failures == 0 and 0 or 1)
