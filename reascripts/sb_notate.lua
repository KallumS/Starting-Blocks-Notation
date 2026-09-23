--[[
 * sb_notate.lua - turns a block into an engraved page.
 *
 * Pure. No `reaper.`, no `ImGui.`, and no drawing: it decides what is on the
 * page and where, in units of a staff space, and `sb_draw.lua` puts ink on it.
 * That split is what makes the engraving testable - a beam group, a stem
 * direction or an accidental is a value this file returns, not a line someone
 * has to look at.
 *
 * The conventions it follows are the ordinary ones, and where there was a
 * choice to make they are Gehrkens, *Music Notation and Terminology* (1914),
 * cited by section: stems (Sec. 2), beamed groups (Sec. 4), rests (Sec. 5),
 * dots (Sec. 11), accidentals lasting to the bar (Sec. 24) and across a tie
 * (Sec. 25), and the whole rest as a measure rest (Sec. 33).
--]]

local M = {}

-- The engine's PPQ, so a block's beats land on whole ticks and the arithmetic
-- below can be integer. 960 divides by 64ths (60) and by triplets of them
-- (40), which is the smallest thing any panel can ask for.
M.TPQ = 960

local LETTER_PC = { 0, 2, 4, 5, 7, 9, 11 }          -- C D E F G A B
local LETTERS   = { "C", "D", "E", "F", "G", "A", "B" }

-- Where a staff's bottom line sits, as a diatonic step. A step is
-- `octave * 7 + letter`, so middle C is 28 and every step is one staff degree:
-- the whole point of counting this way is that a line or a space is one step,
-- whatever accidental the note is wearing.
M.CLEFS = {
  treble = { bottom = 30 },    -- E4
  bass   = { bottom = 18 },    -- G2
  perc   = { bottom = 0  },    -- positions come from the kit, not from pitch
}

M.MIDDLE_C = 28

------------------------------------------------------------------------------
-- Key signature and spelling
------------------------------------------------------------------------------

-- The order the accidentals are written in, as letter indices.
local SHARP_ORDER = { 3, 0, 4, 1, 5, 2, 6 }         -- F C G D A E B
local FLAT_ORDER  = { 6, 2, 5, 1, 4, 0, 3 }         -- B E A D G C F

-- Which letter each pitch class takes when nothing else decides. Two tables,
-- because a sharp key and a flat key disagree about all five black notes.
local SHARP_SPELL = { [0]={0,0}, [1]={0,1}, [2]={1,0}, [3]={1,1}, [4]={2,0},
                      [5]={3,0}, [6]={3,1}, [7]={4,0}, [8]={4,1}, [9]={5,0},
                      [10]={5,1}, [11]={6,0} }
local FLAT_SPELL  = { [0]={0,0}, [1]={1,-1}, [2]={1,0}, [3]={2,-1}, [4]={2,0},
                      [5]={3,0}, [6]={4,-1}, [7]={4,0}, [8]={5,-1}, [9]={5,0},
                      [10]={6,-1}, [11]={6,0} }

-- The accidental a signature of `count` sharps or flats puts on each letter.
function M.signatureMap(sig)
  local map = {}
  for i = 0, 6 do map[i] = 0 end
  local order = (sig.kind == "flat") and FLAT_ORDER or SHARP_ORDER
  local acc   = (sig.kind == "flat") and -1 or 1
  for i = 1, math.min(sig.count, 7) do map[order[i]] = acc end
  return map
end

-- Which key signature to print, scored rather than looked up.
--
-- A lookup table would answer for the major and minor keys and have nothing to
-- say about the other fourteen scales here, several of which cannot be written
-- as a signature at all: harmonic minor's seventh is an accidental in every
-- edition ever printed, and the diminished scales spell two of their notes on
-- one letter, so no signature can hold them. Scoring each of the fifteen
-- candidates against what the scale actually spells picks the right one in the
-- cases a table would have covered, and picks a sane one in the cases it
-- would not: the signature that leaves the fewest accidentals on the page.
--
-- `spelled` is a list of { letter, acc } - the scale's own notes.
function M.chooseSignature(spelled, tonicAcc)
  local best
  for count = 0, 7 do
    for _, kind in ipairs({ "sharp", "flat" }) do
      if not (count == 0 and kind == "flat") then      -- 0 sharps is 0 flats
        local sig = { count = count, kind = kind }
        local map, score = M.signatureMap(sig), 0
        for _, n in ipairs(spelled) do
          if map[n.letter] == n.acc then score = score + 1
          else score = score - 1 end
        end
        -- Ties go to the smaller signature, and then to the one that leans the
        -- way the tonic does, so C# major is seven sharps and Db major is five
        -- flats rather than whichever was tried first.
        local better = (not best) or score > best.score
          or (score == best.score and count < best.count)
          or (score == best.score and count == best.count
              and tonicAcc and tonicAcc < 0 and kind == "flat")
        if better then best = { count = count, kind = kind, score = score } end
      end
    end
  end
  return { count = best.count, kind = best.kind }
end

-- Everything the engraver needs to know about the key, read off the engine's
-- own tables so the notation agrees with the note names the window prints.
-- `E` is sb_engine; nothing else in this file knows it exists.
function M.context(E, st)
  local sc      = E.SCALES[st.scale]
  local spelled = {}
  local spell   = {}                                   -- pitch class -> letter, acc

  for d = 0, #sc.iv - 1 do
    local letter = (E.ROOTS[st.root].letter + sc.letters[d + 1]) % 7
    local pc     = E.scalePitch(st, d) % 12
    local acc    = pc - LETTER_PC[letter + 1]
    if acc >  6 then acc = acc - 12 end
    if acc < -6 then acc = acc + 12 end
    spelled[#spelled + 1] = { letter = letter, acc = acc }
    -- A scale that spells two notes on one letter keeps the first: the blues
    -- and diminished scales do this, and the lower of the pair is the one the
    -- ear hears as the degree.
    if not spell[pc] then spell[pc] = { letter = letter, acc = acc } end
  end

  local sig = M.chooseSignature(spelled, E.ROOTS[st.root].acc)
  return { spell = spell, sig = sig, sigMap = M.signatureMap(sig) }
end

-- A MIDI pitch as a written note: which staff degree, and what accidental it
-- is wearing. The key's own spelling first, so F# major's seventh is E# here
-- as it is everywhere else in the app; anything chromatic falls back to the
-- side the signature leans.
function M.spell(pitch, ctx)
  local pc = pitch % 12
  local e  = ctx.spell and ctx.spell[pc]
  local letter, acc
  if e then
    letter, acc = e.letter, e.acc
  else
    local t = (ctx.sig.kind == "flat" and ctx.sig.count > 0)
              and FLAT_SPELL[pc] or SHARP_SPELL[pc]
    letter, acc = t[1], t[2]
  end
  -- The written octave follows the letter, not the sounding pitch, or Cb4
  -- would be filed an octave below the C it is written on.
  local oct = math.floor((pitch - acc) / 12) - 1
  return { step = oct * 7 + letter, letter = letter, acc = acc, oct = oct }
end

function M.stepName(step)
  return LETTERS[step % 7 + 1] .. tostring(math.floor(step / 7))
end

------------------------------------------------------------------------------
-- Note values
------------------------------------------------------------------------------

-- Every value a note can be written as, in ticks. Built rather than typed so
-- that the triplet and the dotted forms cannot drift out of step with the
-- plain ones.
local VALUES, BY_TICKS = {}, {}
do
  local DOT = { 1, 1.5, 1.75 }
  for _, den in ipairs({ 1, 2, 4, 8, 16, 32, 64 }) do
    for dots = 0, 2 do
      for _, tup in ipairs({ 1, 3 }) do
        local t = 4 * M.TPQ / den * DOT[dots + 1] * (tup == 3 and 2 / 3 or 1)
        -- A dotted triplet is a thing that exists and a thing nothing here can
        -- generate, and leaving it in the set let the fallback below reach for
        -- a double-dotted triplet sixteenth in place of a plain one.
        if tup == 3 and dots > 0 then t = 0 end
        if t == math.floor(t) and t > 0 then
          local v = { ticks = t, den = den, dots = dots,
                      tuplet = (tup == 3) and 3 or nil }
          VALUES[#VALUES + 1] = v
          -- Two spellings of one duration go to the plainer of the two: a
          -- dotted crotchet is never a triplet minim on the page.
          local old = BY_TICKS[t]
          local rank = (v.tuplet and 4 or 0) + dots
          if not old or rank < old.rank then
            BY_TICKS[t] = { v = v, rank = rank }
          end
        end
      end
    end
  end
  table.sort(VALUES, function(a, b)
    if a.ticks ~= b.ticks then return a.ticks > b.ticks end
    if (a.tuplet ~= nil) ~= (b.tuplet ~= nil) then return a.tuplet == nil end
    return a.dots < b.dots
  end)
end

M.VALUES = VALUES

function M.value(ticks)
  local e = BY_TICKS[ticks]
  return e and e.v or nil
end

-- The value closest to a duration that has none of its own. Used as a last
-- resort, where writing something a reader can count beats writing something
-- exact that no symbol exists for.
function M.nearestValue(ticks)
  local best, gap
  for _, v in ipairs(VALUES) do
    local d = math.abs(v.ticks - ticks)
    if not gap or d < gap then best, gap = v, d end
  end
  return best
end

-- How many hooks or beams a value carries: an eighth one, a sixteenth two.
function M.hooks(v)
  if v.den <= 4 then return 0 end
  local n, den = 0, 4
  while den < v.den do den, n = den * 2, n + 1 end
  return n
end

-- The coarsest value that divides an onset, which is as much note as that
-- onset can carry without the beat underneath it going missing.
local function alignment(pos, cap)
  if pos == 0 then return cap end
  for _, v in ipairs(VALUES) do
    if v.ticks <= cap and pos % v.ticks == 0 then return v.ticks end
  end
  return 1
end

-- One duration as the notes it is actually written with, in order, tied.
--
-- Nearly always that is one note: everything the panels can ask for is a rate
-- times a count, so the duration is a value the notation already has a symbol
-- for, and a symbol that exists is the one to use wherever it falls. A half
-- note on the second beat of a three-four bar is written as a half note, and a
-- rule that split it at the beat because the beat divides the bar would be
-- wrong about a bar of printed music.
--
-- Only a duration with no symbol of its own is decomposed, and then by the
-- ordinary rule: the longest value that fits and that the onset can carry.
-- Counting the position rather than accumulating lengths keeps a long tie
-- chain from drifting.
function M.split(pos, ticks, barTicks)
  if ticks <= 0 then return nil end
  local single = M.value(ticks)
  if single then return { single } end

  local out, p, left = {}, pos, ticks
  local guard = 0
  while left > 0 do
    guard = guard + 1
    if guard > 16 then return nil end                 -- pathological; caller rests it
    local align = alignment(p % barTicks, barTicks)
    local took
    for _, v in ipairs(VALUES) do
      if v.ticks <= left and v.ticks <= align then took = v; break end
    end
    -- Nothing the onset can carry is also short enough to fit. Take the
    -- longest that fits at all rather than stalling; the tie still adds up.
    if not took then
      for _, v in ipairs(VALUES) do
        if v.ticks <= left then took = v; break end
      end
    end
    if not took then return nil end                   -- shorter than a 64th
    out[#out + 1] = took
    p, left = p + took.ticks, left - took.ticks
  end
  return out
end

-- The grid a block was laid out on: its own rate, which is what its onsets are
-- multiples of. The engraver snaps to this, so a shuffle comes back onto the
-- beat and everything else is left exactly where it was.
function M.gridFor(E, st)
  if st.cat == "Drums" then return E.drumStep(st) end
  if st.cat == "Chord"  then return E.chopBeats(st) end
  return E.rateBeats(st)
end

------------------------------------------------------------------------------
-- The kit
------------------------------------------------------------------------------

-- Where each piece is written on the percussion staff, in half-spaces above
-- the bottom line, and with what head. The app plays one piece at a time, so
-- these only have to be recognisable rather than to avoid each other.
M.DRUM_MAP = {
  [36] = { pos = 1,  head = "normal" },   -- Kick, first space
  [41] = { pos = 3,  head = "normal" },   -- Low tom
  [38] = { pos = 5,  head = "normal" },   -- Snare, third space
  [47] = { pos = 7,  head = "normal" },   -- Mid tom
  [50] = { pos = 9,  head = "normal" },   -- High tom, above the staff
  [51] = { pos = 8,  head = "cross"  },   -- Ride, top line
  [42] = { pos = 10, head = "cross"  },   -- Closed hi-hat
  [46] = { pos = 10, head = "open"   },   -- Open hi-hat, ringed
  [49] = { pos = 11, head = "cross"  },   -- Crash
}

------------------------------------------------------------------------------
-- Laying the block out
------------------------------------------------------------------------------

local EPS = 1e-6

local function tick(beats) return math.floor(beats * M.TPQ + 0.5) end

-- Notes that begin together are one chord. Everything this app generates is a
-- single voice, so an onset is an event and there is nothing to untangle.
--
-- How long each one is *written* is not how long it sounds. Every block leaves
-- here gated - a chord set to fill a bar sounds nine tenths of it and stops,
-- so the player hears the change - and notating that literally would put a
-- 63/64ths-and-a-rest where a whole note belongs. What the notation wants is
-- the note's share of the bar, which is the distance to whatever starts next.
-- The gate is a property of the MIDI, and the MIDI is still exported gated.
local function events(notes, total, capTicks, gridTicks)
  local by, order = {}, {}
  local taken = {}
  local raw = {}
  for _, n in ipairs(notes) do raw[#raw + 1] = n end
  table.sort(raw, function(a, b) return a.start < b.start end)

  for _, n in ipairs(raw) do
    local t = tick(n.start)
    -- A shuffle pushes every second hit off the grid on purpose, and no note
    -- value can say "a third of the way to the next one". Printed music writes
    -- a shuffle straight and names it at the top, which is exactly what the
    -- block's own name already does - "Kick 1/16 shuffle 40" - so the onsets
    -- go back on the grid here and the name carries the swing.
    if gridTicks and gridTicks > 0 then
      local snapped = math.floor(t / gridTicks + 0.5) * gridTicks
      -- The offset is never a whole step, so two hits cannot legitimately
      -- land on one: if they do, keep them apart rather than losing one.
      if taken[snapped] and not by[t] then snapped = snapped + gridTicks end
      taken[snapped] = true
      t = snapped
    end
    if t < total then
      if not by[t] then by[t] = { at = t, notes = {} }; order[#order + 1] = t end
      local e = by[t]
      e.notes[#e.notes + 1] = n
    end
  end
  table.sort(order)
  local out = {}
  for i, t in ipairs(order) do
    local e = by[t]
    local nextAt = order[i + 1] or total
    e.dur = math.max(nextAt - t, 1)
    -- A drum does not sustain, so a lone crash in an eight-bar block is a hit
    -- and then silence rather than eight bars of tied whole notes.
    if capTicks then e.dur = math.min(e.dur, capTicks) end
    out[#out + 1] = e
  end
  return out
end

-- Treble, bass, or both. A block that stays on one side of middle C gets one
-- staff, which is most of them; a chord that straddles it gets the great
-- staff. Deciding once for the whole block rather than note by note keeps a
-- run from hopping staves in the middle of itself.
local function chooseStaves(evts, ctx, drums)
  if drums then return { { clef = "perc" } }, function(n) return 1 end end

  local lo, hi = 200, -1
  for _, e in ipairs(evts) do
    for _, n in ipairs(e.notes) do
      lo, hi = math.min(lo, n.pitch), math.max(hi, n.pitch)
    end
  end
  if hi < 0 then return { { clef = "treble" } }, function() return 1 end end

  if lo >= 60 then return { { clef = "treble" } }, function() return 1 end end
  -- A block that sits just under middle C is a bass staff on its own rather
  -- than a great staff with an empty top half.
  if hi < 60 then return { { clef = "bass" } }, function() return 1 end end
  return { { clef = "treble" }, { clef = "bass" } },
         function(n) return n.pitch >= 60 and 1 or 2 end
end

-- The metric group beams are gathered inside: a quarter note, or the dotted
-- quarter of a compound signature.
local function beamGroup(tsNum, tsDen)
  if tsDen == 8 and tsNum % 3 == 0 then return M.TPQ * 3 / 2 end
  return M.TPQ
end

-- `block` is what sb_engine.generate returns. `opts` carries the bar, the
-- signature, the key context, and whether this is the kit.
function M.layout(block, opts)
  opts = opts or {}
  local ctx      = opts.ctx or { sig = { count = 0, kind = "sharp" },
                                 sigMap = M.signatureMap({ count = 0, kind = "sharp" }) }
  local tsNum    = opts.tsNum or 4
  local tsDen    = opts.tsDen or 4
  local barTicks = math.max(tick(opts.barBeats or 4), M.TPQ / 4)
  local drums    = opts.drums or false

  local doc = {
    sig    = ctx.sig,
    time   = { num = tsNum, den = tsDen },
    totalTicks = 0,
    drums  = drums,
    name   = block and block.name or "",
    staves = nil,
    measures = {},
  }

  local total = math.max(tick((block and block.beats) or 0), 1)
  local bars  = math.max(1, math.ceil((total - EPS) / barTicks))

  local grid = opts.grid and tick(opts.grid) or nil
  local evts = block and events(block.notes, total, drums and barTicks or nil, grid) or {}
  local assign
  doc.staves, assign = chooseStaves(evts, ctx, drums)

  -- Every event, cut at the bar lines and turned into written values. A note
  -- that crosses a bar becomes two notes and a tie (Sec. 25).
  local perBar = {}
  for i = 1, bars do perBar[i] = {} end

  for _, e in ipairs(evts) do
    local at, left = e.at, e.dur
    local firstPiece = true
    while left > 0 do
      local bar     = math.floor(at / barTicks)
      if bar >= bars then break end
      local barEnd  = (bar + 1) * barTicks
      local chunk   = math.min(left, barEnd - at)
      local pieces  = M.split(at, chunk, barTicks)
      -- A duration no run of tied values can reach exactly is written as the
      -- nearest one there is. This is the only place the page stops being a
      -- faithful account of the MIDI, and it takes a deliberately odd block
      -- to reach it.
      if not pieces then pieces = { M.nearestValue(chunk) } end

      local off = at - bar * barTicks
      for i, v in ipairs(pieces) do
        local last   = (i == #pieces) and (left - chunk <= 0)
        local target = perBar[bar + 1]
        target[#target + 1] = {
          kind    = "chord",
          at      = off,
          ticks   = v.ticks,
          value   = v,
          notes   = e.notes,
          tieIn   = not (firstPiece and i == 1),
          tieOut  = not last,
        }
        off = off + v.ticks
        firstPiece = false
      end
      at, left = at + chunk, left - chunk
    end
  end

  ------------------------------------------------------------------------------
  -- Measures
  ------------------------------------------------------------------------------

  local group = beamGroup(tsNum, tsDen)

  for b = 1, bars do
    local mBeats = math.min(barTicks, total - (b - 1) * barTicks)
    local m = { index = b, ticks = barTicks, used = math.max(mBeats, 0), staves = {} }
    for s = 1, #doc.staves do m.staves[s] = { elements = {} } end

    -- Accidentals last to the bar (Sec. 24), and they are remembered per staff
    -- degree, so a sharp on one octave's F says nothing about another's.
    local sounding = {}

    -- Sort this bar's pieces by onset, then split them across the staves.
    local pieces = perBar[b]
    table.sort(pieces, function(x, y) return x.at < y.at end)

    local byStaff = {}
    for s = 1, #doc.staves do byStaff[s] = {} end

    for _, p in ipairs(pieces) do
      local split = {}
      for _, n in ipairs(p.notes) do
        local s = assign(n)
        split[s] = split[s] or {}
        table.insert(split[s], n)
      end
      for s, ns in pairs(split) do
        local heads = {}
        for _, n in ipairs(ns) do
          local head
          if drums then
            local d = M.DRUM_MAP[n.pitch] or { pos = 5, head = "normal" }
            head = { pos = d.pos, glyph = d.head, pitch = n.pitch }
          else
            local sp  = M.spell(n.pitch, ctx)
            local pos = sp.step - M.CLEFS[doc.staves[s].clef].bottom
            local key = sp.step
            local want = sp.acc
            local have = sounding[key]
            if have == nil then have = ctx.sigMap[sp.letter] or 0 end
            head = { pos = pos, glyph = "normal", pitch = n.pitch,
                     step = sp.step, name = M.stepName(sp.step) }
            -- Show it when it changes what the degree is sounding, and hold it
            -- until the bar line. A tie carries it further (Sec. 25), which is
            -- why a tied-in piece never asks for one again.
            if want ~= have and not p.tieIn then
              head.acc = want
              sounding[key] = want
            elseif not p.tieIn then
              sounding[key] = have
            end
          end
          heads[#heads + 1] = head
        end
        table.sort(heads, function(x, y) return x.pos < y.pos end)
        local el = {
          kind   = "chord",
          at     = p.at,
          ticks  = p.ticks,
          value  = p.value,
          heads  = heads,
          tieIn  = p.tieIn,
          tieOut = p.tieOut,
        }
        local list = byStaff[s]
        list[#list + 1] = el
      end
    end

    -- Rests fill whatever the notes left. A bar with nothing in it at all is
    -- one whole rest, whatever the signature says (Sec. 33).
    for s = 1, #doc.staves do
      local list = byStaff[s]
      table.sort(list, function(x, y)
        if x.at ~= y.at then return x.at < y.at end
        return x.ticks < y.ticks
      end)

      local filled, out = {}, {}
      for _, el in ipairs(list) do
        out[#out + 1] = el
        filled[#filled + 1] = { el.at, el.at + el.ticks }
      end

      local limit = m.used
      if #list == 0 then
        if limit > 0 then
          out[#out + 1] = { kind = "rest", at = 0, ticks = limit,
                            value = { den = 1, dots = 0 }, measureRest = true }
        end
      else
        table.sort(filled, function(x, y) return x[1] < y[1] end)
        local cursor = 0
        local gaps = {}
        for _, span in ipairs(filled) do
          if span[1] > cursor + EPS then gaps[#gaps + 1] = { cursor, span[1] } end
          cursor = math.max(cursor, span[2])
        end
        if limit > cursor + EPS then gaps[#gaps + 1] = { cursor, limit } end
        for _, g in ipairs(gaps) do
          local pieces2 = M.split(g[1], g[2] - g[1], barTicks)
          if pieces2 then
            local off = g[1]
            for _, v in ipairs(pieces2) do
              out[#out + 1] = { kind = "rest", at = off, ticks = v.ticks, value = v }
              off = off + v.ticks
            end
          end
        end
      end

      table.sort(out, function(x, y)
        if x.at ~= y.at then return x.at < y.at end
        return (x.kind == "chord" and 0 or 1) < (y.kind == "chord" and 0 or 1)
      end)
      m.staves[s].elements = out
    end

    -- Where each element falls in the block as a whole, which is what lets a
    -- playhead find the note it is inside without searching for it.
    for _, staff in ipairs(m.staves) do
      for _, el in ipairs(staff.elements) do
        el.abs = (b - 1) * barTicks + el.at
      end
    end

    doc.measures[b] = m
  end

  doc.totalTicks = total

  ------------------------------------------------------------------------------
  -- Stems and beams
  ------------------------------------------------------------------------------

  for _, m in ipairs(doc.measures) do
    for s, staff in ipairs(m.staves) do
      M.beam(staff.elements, group, m.ticks)
      staff.tuplets = M.tuplets(staff.elements)
      M.stems(staff.elements, doc.staves[s].clef == "perc")
      M.placeHeads(staff.elements)
    end
  end

  M.space(doc, opts.width)
  return doc
end

-- Eighths and shorter are gathered into groups inside one metric beat, all
-- stems the same way (Sec. 4). A rest ends a group, and so does a beat.
function M.beam(elements, group, barTicks)
  local runs, cur = {}, nil
  local function close()
    if cur and #cur >= 2 then runs[#runs + 1] = cur end
    if cur and #cur == 1 then cur[1].beam = nil end
    cur = nil
  end
  for _, el in ipairs(elements) do
    local flagged = el.kind == "chord" and M.hooks(el.value) > 0
    if not flagged then
      close()
    else
      local g = math.floor(el.at / group)
      if cur and (cur.group ~= g or cur.endsAt ~= el.at) then close() end
      if not cur then cur = { group = g, endsAt = el.at } end
      cur[#cur + 1] = el
      cur.endsAt = el.at + el.ticks
      el.beam = cur
    end
  end
  close()

  for i, run in ipairs(runs) do
    run.id = i
    for _, el in ipairs(run) do
      el.beam = run
      el.beams = M.hooks(el.value)
    end
  end
  return runs
end

-- The figure over a group of three. A beamed triplet needs only the number,
-- because the beam already says where the group starts and stops; three
-- triplet quarters have no beam to say it, so those get the bracket too.
function M.tuplets(elements)
  local groups, run = {}, {}
  local function flush()
    local i = 1
    while i <= #run do
      local g = { n = 3, elements = {} }
      for k = i, math.min(i + 2, #run) do g.elements[#g.elements + 1] = run[k] end
      -- A run that does not divide by three leaves a group short. The panels
      -- can ask for exactly that - eight triplet eighths is a whole run of the
      -- scale and two thirds of a third group - and the remainder is still
      -- triplet-rate, so it keeps the figure and says so.
      g.partial = #g.elements < 3
      local beam, same = run[i].beam, true
      for _, el in ipairs(g.elements) do
        if el.beam ~= beam or not beam then same = false end
      end
      g.bracket = not same
      g.beam = same and beam or nil
      for _, el in ipairs(g.elements) do el.tuplet = g end
      groups[#groups + 1] = g
      i = i + 3
    end
    run = {}
  end
  for _, el in ipairs(elements) do
    if el.kind == "chord" and el.value.tuplet == 3 then
      run[#run + 1] = el
    else
      flush()
    end
  end
  flush()
  return groups
end

-- Below the middle line the stem turns up, above it turns down, and a chord is
-- decided by whichever of its heads is furthest from that line (Sec. 2). A
-- beamed group goes the way its majority does (Sec. 4).
function M.stems(elements, perc)
  local MIDDLE = 4

  local function want(el)
    local far, dir = 0, "up"
    for _, h in ipairs(el.heads) do
      local d = h.pos - MIDDLE
      if math.abs(d) > math.abs(far) then far, dir = d, (d > 0) and "down" or "up" end
    end
    if far == 0 then return "up" end
    return dir
  end

  local done = {}
  for _, el in ipairs(elements) do
    if el.kind == "chord" then
      el.stem = (el.value.den >= 2) and want(el) or nil
      if el.value.den == 1 then el.stem = nil end
      if el.beam and not done[el.beam] then
        done[el.beam] = true
        local up = 0
        for _, e in ipairs(el.beam) do
          if want(e) == "up" then up = up + 1 else up = up - 1 end
        end
        el.beam.stem = (up >= 0) and "up" or "down"
      end
      if el.beam then el.stem = el.beam.stem end
    end
  end
end

------------------------------------------------------------------------------
-- Heads and accidentals
------------------------------------------------------------------------------

-- Half a notehead, in spaces. `sb_draw.lua` draws the ellipse exactly this
-- wide and reads these rather than keeping its own copy: the layout cannot say
-- where the accidental in front of a head goes without knowing how much room
-- the head takes, and two numbers that have to agree should be one number.
M.HEAD_RX  = 0.62
M.WHOLE_RX = 0.82

-- How wide each accidental is, and the air between the block of them and the
-- leftmost head.
M.ACC_WIDTHS = { [-2] = 1.25, [-1] = 0.78, [0] = 0.80, [1] = 0.90, [2] = 0.80 }
M.ACC_PAD    = 0.30

-- How far apart two accidentals must be before they can share a column, in
-- staff degrees. A sharp stands about two and a half spaces tall, which is
-- five of these, so a sixth apart is the rule and leaves a little air.
M.ACC_CLEAR  = 6

-- Which side of the stem each head sits on, and where each accidental goes.
--
-- This runs after `M.stems`, because both answers depend on which way the stem
-- turned: a head pushed off a downward stem goes to the *left* of it, and the
-- accidentals then have to clear a head that is a whole width further out than
-- the rest. Not clearing it is what drew a sharp underneath a notehead.
function M.placeHeads(elements)
  for _, el in ipairs(elements) do
    if el.kind == "chord" and el.heads then
      local rx = (el.value.den <= 1) and M.WHOLE_RX or M.HEAD_RX

      -- Which way a crossed head goes, decided **here and once**. A downward
      -- stem puts it on the left, anything else on the right - and a whole
      -- note, which has no stem at all, counts as anything else.
      --
      -- This used to be worked out twice, once here as `stem ~= "down"` and
      -- once in the drawing as `stem == "up"`. Those agree about every note
      -- with a stem and disagree about every note without one, so a whole-note
      -- chord put its crossed head on the left while the accidentals were
      -- placed as though it had gone right. That is how a sharp ended up
      -- underneath a notehead.
      el.sideDir = (el.stem == "down") and -1 or 1

      -- Two heads a step apart cannot both sit on the same side of the stem,
      -- so the upper of each such pair crosses it. This is the one thing that
      -- makes a close-voiced chord readable rather than a blot.
      local flip = false
      for i, h in ipairs(el.heads) do
        local prev = el.heads[i - 1]
        flip = (prev ~= nil and math.abs(h.pos - prev.pos) == 1 and not flip)
        h.side = flip and 1 or 0
      end

      -- How far left of the chord's own x the ink reaches.
      local left = rx
      for _, h in ipairs(el.heads) do
        if h.side == 1 and el.sideDir < 0 then left = math.max(left, 3 * rx) end
      end
      el.headLeft = left

      -- The accidentals, in columns working out from the heads. A column holds
      -- as many as will fit without touching, so a chord with two of them far
      -- apart keeps both in one column instead of marching off to the left.
      -- Topmost first, which is the order that puts it nearest the chord.
      local cols, used = {}, 0
      for i = #el.heads, 1, -1 do
        local h = el.heads[i]
        h.accCol, h.accDX = nil, nil
        if h.acc then
          local c = 1
          while true do
            local clash = false
            for _, p in ipairs(cols[c] or {}) do
              if math.abs(p - h.pos) < M.ACC_CLEAR then clash = true; break end
            end
            if not clash then break end
            c = c + 1
          end
          cols[c] = cols[c] or {}
          cols[c][#cols[c] + 1] = h.pos
          h.accCol = c
          used = math.max(used, c)
        end
      end

      -- Each column is as wide as its widest accidental, and every accidental
      -- in it is centred on that width.
      local at = left + M.ACC_PAD
      local centre = {}
      for c = 1, used do
        local w = 0
        for _, h in ipairs(el.heads) do
          if h.accCol == c then w = math.max(w, M.ACC_WIDTHS[h.acc] or 0.8) end
        end
        centre[c] = at + w / 2
        at = at + w
      end
      for _, h in ipairs(el.heads) do
        if h.accCol then h.accDX = -centre[h.accCol] end
      end
      el.accWidth = (used > 0) and (at - left) or 0
    end
  end
end

------------------------------------------------------------------------------
-- Spacing
------------------------------------------------------------------------------

-- Everything from here is measured in staff spaces, so the drawing code needs
-- one number - how many pixels a space is - and nothing else.
M.PAD_LEFT   = 1.2      -- inside a bar line, before the first note
M.PAD_RIGHT  = 1.2
M.MIN_GAP    = 2.2      -- between one onset and the next
M.ACC_WIDTH  = 1.1
M.CLEF_WIDTH = 3.2
M.SIG_STEP   = 0.9
M.TIME_WIDTH = 2.4

-- How wide a duration wants to be. Proportional would make a whole note eight
-- times a quarter and a page mostly air, so this is the usual compromise: the
-- width grows with the square root of the duration.
local function widthFor(ticks)
  return M.MIN_GAP * math.sqrt(ticks / M.TPQ)
end

function M.space(doc, width)
  -- What goes in front of the first measure of every system.
  local head = M.CLEF_WIDTH + M.TIME_WIDTH + 0.8
             + doc.sig.count * M.SIG_STEP + (doc.sig.count > 0 and 0.6 or 0)
  doc.headWidth = head

  for _, m in ipairs(doc.measures) do
    -- One column per onset, shared by both staves so the great staff lines up.
    local onsets, seen = {}, {}
    for _, staff in ipairs(m.staves) do
      for _, el in ipairs(staff.elements) do
        if not seen[el.at] then seen[el.at] = true; onsets[#onsets + 1] = el.at end
      end
    end
    table.sort(onsets)

    local x, at = M.PAD_LEFT, {}
    for i, o in ipairs(onsets) do
      -- An accidental is written in front of the note, so the column has to
      -- open far enough to the left to hold it - and a chord needing two
      -- columns of them needs twice the room, which is why the element works
      -- its own width out rather than being given a flat allowance here.
      local acc = 0
      for _, staff in ipairs(m.staves) do
        for _, el in ipairs(staff.elements) do
          if el.at == o then acc = math.max(acc, el.accWidth or 0) end
        end
      end
      x = x + acc
      at[o] = x
      local nextAt = onsets[i + 1]
      local span = nextAt and (nextAt - o) or (m.ticks - o)
      x = x + math.max(widthFor(math.max(span, 1)), M.MIN_GAP)
    end
    m.width = math.max(x + M.PAD_RIGHT, 6)

    for _, staff in ipairs(m.staves) do
      for _, el in ipairs(staff.elements) do el.x = at[el.at] or M.PAD_LEFT end
    end
  end

  -- Measures run across the page until they run out of room, then start a new
  -- system. A measure wider than a whole system gets one to itself rather than
  -- being dropped.
  local avail = (width or 60) - head
  local systems, cur, used = {}, nil, 0
  for _, m in ipairs(doc.measures) do
    if not cur or (used + m.width > avail and #cur > 0) then
      cur = {}; systems[#systems + 1] = cur; used = 0
    end
    cur[#cur + 1] = m
    used = used + m.width
  end
  -- Stretch each system's measures to fill the line, the way a printed page
  -- does, so a system never stops halfway across with white to its right.
  for _, sys in ipairs(systems) do
    local w = 0
    for _, m in ipairs(sys) do w = w + m.width end
    sys.width = w
    sys.scale = (w > 0 and avail > 0 and #systems > 1) and math.max(1, avail / w) or 1
    if sys == systems[#systems] and #systems > 1 then sys.scale = 1 end
  end
  doc.systems = systems
  return doc
end

return M
