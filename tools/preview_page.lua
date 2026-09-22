--[[
 * Draws real engraved pages to SVG, without REAPER and without ReaImGui.
 *
 *     lua5.4 tools/preview_page.lua > page.svg
 *
 * `sb_draw.lua` draws through a pen rather than through ImGui, so standing a
 * different pen in its place is the whole trick: this one writes SVG, the
 * window's writes into a ReaImGui draw list, and both are drawing the same
 * page from the same layout. What comes out here is therefore the engraving
 * itself rather than a picture of what someone remembers it looking like.
 *
 * Pass block names on the command line to pick which ones to draw; with no
 * arguments it draws a sheet that covers every part of the notation.
--]]

local HERE = (arg and arg[0] or ""):match("^(.*[/\\])") or ""
local E = dofile(HERE .. "../reascripts/sb_engine.lua")
local N = dofile(HERE .. "../reascripts/sb_notate.lua")
local D = dofile(HERE .. "../reascripts/sb_draw.lua")
D.setNotate(N)

------------------------------------------------------------------------------
-- An SVG pen
------------------------------------------------------------------------------

local function hex(col)
  local a = col % 256
  local b = math.floor(col / 256) % 256
  local g = math.floor(col / 65536) % 256
  local r = math.floor(col / 16777216) % 256
  return ("#%02x%02x%02x"):format(r, g, b), a / 255
end

local function newPen(out)
  local function f(n) return ("%.2f"):format(n) end
  return {
    line = function(x1, y1, x2, y2, col, th)
      local c, a = hex(col)
      out[#out + 1] = ('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" ' ..
        'stroke-opacity="%s" stroke-width="%s" stroke-linecap="round"/>')
        :format(f(x1), f(y1), f(x2), f(y2), c, f(a), f(th or 1))
    end,
    poly = function(pts, col)
      local c, a = hex(col)
      local s = {}
      for i = 1, #pts - 1, 2 do s[#s + 1] = f(pts[i]) .. "," .. f(pts[i + 1]) end
      out[#out + 1] = ('<polygon points="%s" fill="%s" fill-opacity="%s"/>')
        :format(table.concat(s, " "), c, f(a))
    end,
    circle = function(x, y, r, col, filled)
      local c, a = hex(col)
      if filled then
        out[#out + 1] = ('<circle cx="%s" cy="%s" r="%s" fill="%s" fill-opacity="%s"/>')
          :format(f(x), f(y), f(r), c, f(a))
      else
        out[#out + 1] = ('<circle cx="%s" cy="%s" r="%s" fill="none" stroke="%s" ' ..
          'stroke-opacity="%s" stroke-width="%s"/>'):format(f(x), f(y), f(r), c, f(a), f(r * 0.4))
      end
    end,
    text = function(x, y, col, s, size, center)
      local c, a = hex(col)
      out[#out + 1] = ('<text x="%s" y="%s" fill="%s" fill-opacity="%s" ' ..
        'font-family="Helvetica,Arial,sans-serif" font-size="%s" font-weight="600" ' ..
        'text-anchor="%s" dominant-baseline="central">%s</text>')
        :format(f(x), f(y), c, f(a), f(size or 12), center and "middle" or "start",
                tostring(s))
    end,
  }
end

------------------------------------------------------------------------------
-- The blocks to draw
------------------------------------------------------------------------------

local function byName(list, name, get)
  for i, v in ipairs(list) do
    if (get and get(v) or v) == name then return i end
  end
  return 1
end
local RATE = function(n) return byName(E.RATES, n, function(r) return r.name end) end
local BARS = function(n) return byName(E.BAR_LENGTHS, n, function(b) return b.name end) end
local LM   = function(n) return n end   -- a name, not an index
local ROOT = function(n) return byName(E.ROOTS, n, function(r) return r.name end) end
local SCL  = function(n) return byName(E.SCALES, n, function(s) return s.name end) end

local SHEET = {
  { "A triad, a whole bar", function(s) end },
  { "The same chord chopped into eighths",
    function(s) s.chop = RATE("1/8") end },
  { "A thirteenth, which needs both staves",
    function(s) s.family = 5; s.chord = 30; s.oct = -1 end },
  { "An arpeggio in eighths",
    function(s) s.cat = "Arpeggio"; s.rate = RATE("1/8")
                s.lengthMode = LM("Bars"); s.bars = BARS("1") end },
  { "A run of sixteenths, beamed to the beat",
    function(s) s.cat = "Run"; s.rate = RATE("1/16")
                s.lengthMode = LM("Bars"); s.bars = BARS("1") end },
  { "Triplet eighths",
    function(s) s.cat = "Run"; s.rate = RATE("1/8"); s.rateMod = 2
                s.lengthMode = LM("Bars"); s.bars = BARS("1") end },
  { "Triplet quarters, which get the bracket",
    function(s) s.cat = "Arpeggio"; s.rate = RATE("1/4"); s.rateMod = 2
                s.lengthMode = LM("Bars"); s.bars = BARS("1") end },
  { "Dotted quarters, tied across the bar",
    function(s) s.chop = RATE("1/4"); s.rateMod = 3; s.bars = BARS("2") end },
  { "A harmonic minor: the seventh is an accidental",
    function(s) s.root = ROOT("A"); s.scale = SCL("Harm Minor")
                s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = LM("Bars")
                s.bars = BARS("1") end },
  { "Five flats",
    function(s) s.root = ROOT("Db"); s.scale = SCL("Major")
                s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = LM("Bars")
                s.bars = BARS("1") end },
  { "Six sharps",
    function(s) s.root = ROOT("F#"); s.scale = SCL("Major")
                s.cat = "Run"; s.rate = RATE("1/8"); s.lengthMode = LM("Bars")
                s.bars = BARS("1") end },
  { "The diminished scale, which no signature can hold",
    function(s) s.scale = SCL("Dim W-H"); s.cat = "Run"; s.rate = RATE("1/8")
                s.lengthMode = LM("Bars"); s.bars = BARS("1") end },
  { "A bass line, on its own staff",
    function(s) s.cat = "Bass"; s.bassOct = -2; s.rate = RATE("1/8") end },
  { "The kit: a kick in sixteenths, shuffled",
    function(s) s.cat = "Drums"; s.drumPiece = 1; s.drumRate = "1/16"
                s.shuffle = 40 end },
  { "The kit: closed hats and a backbeat rate",
    function(s) s.cat = "Drums"; s.drumPiece = 3; s.drumRate = "1/8" end },
  { "Four bars, which wrap onto a second system",
    function(s) s.cat = "Run"; s.rate = RATE("1/8")
                s.lengthMode = LM("Bars"); s.bars = BARS("4") end },
}

------------------------------------------------------------------------------

local SP      = 10
local WIDTH   = 760
local INK     = 0xE8EBEFFF
local STAFFC  = 0x9AA2AEFF
local GROUND  = 0x151A20FF
local ACCENT  = 0xFFF200FF
local LABEL   = 0x8A919CFF

local out, y = {}, 24
local picked = {}
for i = 1, #arg do picked[arg[i]] = true end

for _, entry in ipairs(SHEET) do
  local label, mut = entry[1], entry[2]
  if next(picked) == nil or picked[label] then
    local st = E.newState()
    st.barBeats = 4
    mut(st)
    E.clampState(st)

    local ctx   = N.context(E, st)
    local block = E.generate(st)
    local doc   = N.layout(block, {
      barBeats = 4, ctx = ctx, drums = st.cat == "Drums",
      grid = N.gridFor(E, st), width = (WIDTH - 70) / SP,
    })

    out[#out + 1] = ('<text x="20" y="%.1f" fill="#8a919c" font-family="Helvetica,Arial" ' ..
      'font-size="11">%s &#183; %s</text>'):format(y, label,
      (block.name:gsub("&", "&amp;")))
    y = y + 10

    local pen = newPen(out)
    local h = D.page(pen, doc, 40, y, SP,
                     { ink = INK, staff = STAFFC, ground = GROUND, accent = ACCENT })
    y = y + h + 22
  end
end

local H = math.ceil(y)
local head = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" ' ..
  'viewBox="0 0 %d %d"><rect width="100%%" height="100%%" fill="#151a20"/>')
  :format(WIDTH, H, WIDTH, H)
print(head .. table.concat(out, "\n") .. "</svg>")
