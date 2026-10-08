#!/usr/bin/env python3
"""Bakes Bravura's outlines into reascripts/sb_glyphs.lua.

    pip install fonttools shapely
    python3 tools/bake_glyphs.py path/to/Bravura.otf > reascripts/sb_glyphs.lua

Bravura is the SMuFL reference font (SIL Open Font License), from
https://github.com/steinbergmedia/bravura - `redist/otf/Bravura.otf`.

The script cannot count on anyone having a music font installed (0004), so
the outlines travel as data instead: each glyph flattened into polygons, in
staff spaces, y running down, origin where SMuFL puts it. That is all a
REAPER user ever gets - the font file itself is only needed to run this again.

Every polygon is written so the window's pen can fill it in one call:

- **No holes.** ReaImGui fills a simple polygon, concave or not, but not one
  with a hole in it. A glyph with a counter - the bowl of a flat, the loops
  of the G clef - is cut through each hole into pieces that **overlap** a
  little. Cut flush, the two anti-aliased edges would meet at a faint seam;
  overlapping, each piece's solid interior covers the other's soft edge.
- **Clockwise on screen.** Dear ImGui anti-aliases a fill by pushing a
  fringe outward along each edge's normal, and it works out which way is
  outward from the winding. Anticlockwise, the fringe goes inward.

The open noteheads also keep their exterior and their counter apart
(`outer` and `holes`), because the page punches a notehead's counter with
the paper colour rather than leaving it see-through (see sb_draw.lua).
"""

import sys

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from shapely.geometry import Polygon, MultiPolygon, box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

SPACE = 250.0          # font units to a staff space: a SMuFL em is four
FLAT_TOL = 0.4         # how far a flattened curve may stray, in font units
SIMPLIFY = 0.0025      # in staff spaces; a tenth of a pixel at 40 to the space
OVERLAP = 0.10         # how far each piece of a cut glyph runs past the cut

GLYPHS = [
    ("gClef", 0xE050), ("fClef", 0xE062), ("percClef", 0xE069),
    ("brace", 0xE000),
    ("noteheadWhole", 0xE0A2), ("noteheadHalf", 0xE0A3), ("noteheadBlack", 0xE0A4),
    ("noteheadXWhole", 0xE0A7), ("noteheadXHalf", 0xE0A8), ("noteheadXBlack", 0xE0A9),
    ("flag8thUp", 0xE240), ("flag8thDown", 0xE241),
    ("flag16thUp", 0xE242), ("flag16thDown", 0xE243),
    ("flag32ndUp", 0xE244), ("flag32ndDown", 0xE245),
    ("flag64thUp", 0xE246), ("flag64thDown", 0xE247),
    ("accidentalFlat", 0xE260), ("accidentalNatural", 0xE261),
    ("accidentalSharp", 0xE262), ("accidentalDoubleSharp", 0xE263),
    ("accidentalDoubleFlat", 0xE264),
    ("restWhole", 0xE4E3), ("restHalf", 0xE4E4), ("restQuarter", 0xE4E5),
    ("rest8th", 0xE4E6), ("rest16th", 0xE4E7), ("rest32nd", 0xE4E8),
    ("rest64th", 0xE4E9),
] + [("timeSig%d" % d, 0xE080 + d) for d in range(10)] \
  + [("tuplet%d" % d, 0xE880 + d) for d in range(10)]

# The noteheads whose counters the page punches rather than leaves open.
PUNCHED = {"noteheadWhole", "noteheadHalf"}


class FlattenPen(BasePen):
    """Collects each contour as a list of points, curves flattened."""

    def __init__(self, glyphSet):
        super().__init__(glyphSet)
        self.contours, self.cur = [], []

    def _moveTo(self, p):
        self.cur = [p]

    def _lineTo(self, p):
        self.cur.append(p)

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        # Enough steps that the chord never strays more than FLAT_TOL from the
        # curve: the control polygon's length bounds how far that can be.
        span = sum(((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
                   for a, b in ((p0, p1), (p1, p2), (p2, p3)))
        n = max(2, min(64, int((span / FLAT_TOL) ** 0.5) + 1))
        for i in range(1, n + 1):
            t = i / n
            u = 1 - t
            a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                             a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))

    def _closePath(self):
        if len(self.cur) >= 3:
            self.contours.append(self.cur)
        self.cur = []

    _endPath = _closePath


def signed_area(pts):
    return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1]
               for i in range(len(pts))) / 2


def shape_of(contours):
    """The filled region, by the non-zero rule a CFF font is drawn with.

    The largest contour is certainly an outside, so its winding is the one
    that fills; a contour wound the other way cuts. A filled contour sitting
    inside a cutting one is an island and goes back in afterwards."""
    contours = [[(x / SPACE, y / SPACE) for x, y in c] for c in contours]
    contours.sort(key=lambda c: -abs(signed_area(c)))
    sense = 1 if signed_area(contours[0]) > 0 else -1
    fill, cut = [], []
    for c in contours:
        poly = Polygon(c).buffer(0)
        (fill if signed_area(c) * sense > 0 else cut).append(poly)
    shape = unary_union(fill)
    holes = unary_union(cut) if cut else None
    if holes is not None:
        islands = [f for f in fill if holes.contains(f)]
        shape = shape.difference(holes)
        if islands:
            shape = unary_union([shape] + islands)
    return shape.buffer(0)


def polygons(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    out = []
    for g in getattr(geom, "geoms", []):
        out.extend(polygons(g))
    return out


def without_holes(poly, depth=0):
    """Cuts a polygon through its holes until no piece has one, the pieces
    overlapping by OVERLAP either side of every cut."""
    poly = poly.buffer(0)
    if not poly.interiors:
        return [poly]
    if depth > 12:
        raise RuntimeError("a glyph would not come apart")
    hole = Polygon(poly.interiors[0])
    hx1, hy1, hx2, hy2 = hole.bounds
    x1, y1, x2, y2 = poly.bounds
    big = 10
    tries = []
    # Across the hole's middle, along whichever way it is longer, so the cut
    # certainly passes through it; the other way if that does not work.
    cx, cy = (hx1 + hx2) / 2, (hy1 + hy2) / 2
    vertical = (hx2 - hx1, (box(x1 - big, y1 - big, cx + OVERLAP, y2 + big),
                            box(cx - OVERLAP, y1 - big, x2 + big, y2 + big)))
    horizontal = (hy2 - hy1, (box(x1 - big, y1 - big, x2 + big, cy + OVERLAP),
                              box(x1 - big, cy - OVERLAP, x2 + big, y2 + big)))
    tries = sorted([vertical, horizontal], key=lambda t: -t[0])
    before = len(poly.interiors)
    for _, (a, b) in tries:
        pieces = polygons(poly.intersection(a)) + polygons(poly.intersection(b))
        pieces = [p for p in pieces if p.area > 1e-5]
        if all(len(p.interiors) < before for p in pieces):
            out = []
            for p in pieces:
                out.extend(without_holes(p, depth + 1))
            return out
    raise RuntimeError("no cut opened the hole")


def ring(coords):
    """A ring as screen points: y flipped to run down, clockwise on screen,
    no closing repeat, rounded to what is worth writing down."""
    pts = [(round(x, 3), round(-y, 3)) for x, y in coords[:-1]]
    clean = []
    for p in pts:
        if not clean or p != clean[-1]:
            clean.append(p)
    if len(clean) > 1 and clean[0] == clean[-1]:
        clean.pop()
    # Shoelace positive in y-down coordinates is clockwise on the screen.
    if signed_area(clean) < 0:
        clean.reverse()
    return clean


def lua_ring(pts):
    return "{" + ",".join(("%g,%g" % p) for p in pts) + "}"


def bake(path):
    font = TTFont(path)
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    out = []
    for name, cp in GLYPHS:
        pen = FlattenPen(gs)
        gs[cmap[cp]].draw(pen)
        shape = shape_of(pen.contours).simplify(SIMPLIFY, preserve_topology=True)
        parts = [orient(p, 1.0) for p in polygons(shape)]

        fill = []
        for p in parts:
            for piece in without_holes(p):
                r = ring(list(orient(piece, 1.0).exterior.coords))
                if len(r) >= 3:
                    fill.append(r)

        x1, y1, x2, y2 = shape.bounds
        entry = ["  %s = {" % name,
                 "    x1 = %g, y1 = %g, x2 = %g, y2 = %g,"
                 % (round(x1, 3), round(-y2, 3), round(x2, 3), round(-y1, 3)),
                 "    fill = {"]
        entry += ["      " + lua_ring(r) + "," for r in fill]
        entry.append("    },")
        if name in PUNCHED:
            outer = [ring(list(p.exterior.coords)) for p in parts]
            holes = [ring(list(h.coords)) for p in parts for h in p.interiors]
            entry.append("    outer = {")
            entry += ["      " + lua_ring(r) + "," for r in outer]
            entry.append("    },")
            entry.append("    holes = {")
            entry += ["      " + lua_ring(r) + "," for r in holes]
            entry.append("    },")
        entry.append("  },")
        out.append("\n".join(entry))
    return out


HEADER = """--[[
 * sb_glyphs.lua - the music's symbols, as polygons.
 *
 * GENERATED by tools/bake_glyphs.py from Bravura. Do not edit by hand: change
 * the tool and run it again.
 *
 * Bravura is copyright (c) 2015, Steinberg Media Technologies GmbH
 * (http://www.steinberg.net/), with Reserved Font Name "Bravura", and is
 * licensed under the SIL Open Font License, Version 1.1. These outlines are
 * derived from it and are distributed under that licence too; its text is in
 * sb_glyphs-OFL.txt beside this file. The licence covers this file only - the
 * rest of the script is not font software and is not affected by it.
 *
 * Units are staff spaces, y runs down, and (0, 0) is the glyph's SMuFL
 * origin. Every polygon in `fill` is simple, has no holes and is clockwise
 * on screen; together they cover the glyph, overlapping where it was cut.
 * The open noteheads also carry `outer` and `holes`, so the page can punch
 * a counter with the paper instead of leaving it see-through.
--]]

return {
"""


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: bake_glyphs.py path/to/Bravura.otf")
    sys.stdout.write(HEADER + "\n".join(bake(sys.argv[1])) + "\n}\n")
