"""Generate Reagan's 8-shape flashcards as a print-ready PDF.

Layout: 2 pages, each US-Letter, 2x4 grid (8 cards per side).
Page 1 = FRONTS (just the shape, big & bold, on a colored card).
Page 2 = BACKS (name + sides + interior angle sum + fun fact),
         laid out so when printed double-sided + cut, each card's back lines up.

Shapes (1 → 8 sides):
  1. Circle (special: 0 sides, 360°)
  2. ... we have only 1-side concept doesn't exist; user said "1 side circle to 8 sides"
     so we treat: Circle, Triangle, Square, Pentagon, Hexagon, Heptagon, Octagon, Nonagon
     That's 8 cards.
"""
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch
import math, os

OUT = "/home/ubuntu/reagan_homeschool_dashboard/public-uploads/shape_flashcards.pdf"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

W, H = LETTER  # 612 x 792 pts
MARGIN = 0.4*inch
COLS, ROWS = 2, 4
CARD_W = (W - 2*MARGIN) / COLS
CARD_H = (H - 2*MARGIN) / ROWS

SHAPES = [
    {"name": "Circle",    "sides": "∞ (no straight sides)", "deg": "360°",
     "fun": "A full turn. Wheels, planet orbits, pizzas!", "color": colors.HexColor("#FFD6A5")},
    {"name": "Triangle",  "sides": "3 sides", "deg": "180°",
     "fun": "The strongest shape — bridges & roofs love it.", "color": colors.HexColor("#FDFFB6")},
    {"name": "Square",    "sides": "4 sides", "deg": "360°",
     "fun": "All 4 sides equal, all 4 corners 90°.", "color": colors.HexColor("#CAFFBF")},
    {"name": "Pentagon",  "sides": "5 sides", "deg": "540°",
     "fun": "Like a soccer ball patch or home plate!", "color": colors.HexColor("#9BF6FF")},
    {"name": "Hexagon",   "sides": "6 sides", "deg": "720°",
     "fun": "Bees build their honeycombs in hexagons.", "color": colors.HexColor("#A0C4FF")},
    {"name": "Heptagon",  "sides": "7 sides", "deg": "900°",
     "fun": "7 sides — the lucky polygon!", "color": colors.HexColor("#BDB2FF")},
    {"name": "Octagon",   "sides": "8 sides", "deg": "1080°",
     "fun": "STOP signs are octagons.", "color": colors.HexColor("#FFC6FF")},
    {"name": "Nonagon",   "sides": "9 sides", "deg": "1260°",
     "fun": "Bonus shape! 9 sides, super rare in real life.", "color": colors.HexColor("#FFADAD")},
]

def regular_polygon_points(cx, cy, r, n, rotation=-math.pi/2):
    pts = []
    for i in range(n):
        angle = rotation + i * 2*math.pi/n
        pts.append((cx + r*math.cos(angle), cy + r*math.sin(angle)))
    return pts

def draw_shape_front(c, shape, x0, y0):
    # card background
    c.setFillColor(shape["color"])
    c.setStrokeColor(colors.HexColor("#222"))
    c.setLineWidth(1.2)
    c.roundRect(x0+6, y0+6, CARD_W-12, CARD_H-12, 12, fill=1, stroke=1)

    cx = x0 + CARD_W/2
    cy = y0 + CARD_H/2 + 8
    r = min(CARD_W, CARD_H) * 0.32

    c.setFillColor(colors.HexColor("#1f2937"))
    c.setStrokeColor(colors.HexColor("#1f2937"))
    c.setLineWidth(3)

    name = shape["name"]
    if name == "Circle":
        c.circle(cx, cy, r, fill=1, stroke=1)
    else:
        sides_map = {"Triangle":3,"Square":4,"Pentagon":5,"Hexagon":6,
                     "Heptagon":7,"Octagon":8,"Nonagon":9}
        n = sides_map[name]
        rotation = -math.pi/2
        if name == "Square":
            rotation = -math.pi/4
        pts = regular_polygon_points(cx, cy, r, n, rotation)
        p = c.beginPath()
        p.moveTo(*pts[0])
        for x,y in pts[1:]:
            p.lineTo(x,y)
        p.close()
        c.drawPath(p, fill=1, stroke=1)

    # Card number badge
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#222"))
    c.setLineWidth(1)
    badge_y = y0 + CARD_H - 24
    c.roundRect(x0+14, badge_y-6, 32, 20, 6, fill=1, stroke=1)
    c.setFillColor(colors.HexColor("#222"))
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(x0+14+16, badge_y-2, f"#{SHAPES.index(shape)+1}")

def draw_shape_back(c, shape, x0, y0):
    # card background (same color so they match through paper)
    c.setFillColor(shape["color"])
    c.setStrokeColor(colors.HexColor("#222"))
    c.setLineWidth(1.2)
    c.roundRect(x0+6, y0+6, CARD_W-12, CARD_H-12, 12, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#1f2937"))
    # Title
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(x0 + CARD_W/2, y0 + CARD_H - 50, shape["name"])
    # Sides
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(x0 + CARD_W/2, y0 + CARD_H - 80, shape["sides"])
    # Big angle sum
    c.setFont("Helvetica-Bold", 36)
    c.setFillColor(colors.HexColor("#b00020"))
    c.drawCentredString(x0 + CARD_W/2, y0 + CARD_H/2 - 8, shape["deg"])
    c.setFont("Helvetica", 11)
    c.setFillColor(colors.HexColor("#1f2937"))
    c.drawCentredString(x0 + CARD_W/2, y0 + CARD_H/2 - 28, "(all interior angles add up to)")
    # Fun fact (wrap manually if long)
    c.setFont("Helvetica-Oblique", 10)
    fun = shape["fun"]
    text_obj = c.beginText(x0+18, y0+44)
    # crude wrap
    words = fun.split()
    line = ""
    lines = []
    max_chars = 32
    for w in words:
        if len(line) + len(w) + 1 > max_chars:
            lines.append(line); line = w
        else:
            line = (line+" "+w).strip()
    if line: lines.append(line)
    for L in lines:
        text_obj.textLine(L)
    c.drawText(text_obj)
    # number badge (mirror so it lines up after flip)
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#222"))
    c.setLineWidth(1)
    badge_y = y0 + CARD_H - 24
    # Mirror across vertical: badge on RIGHT instead of LEFT
    c.roundRect(x0+CARD_W-46, badge_y-6, 32, 20, 6, fill=1, stroke=1)
    c.setFillColor(colors.HexColor("#222"))
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(x0+CARD_W-46+16, badge_y-2, f"#{SHAPES.index(shape)+1}")

def positions():
    for r in range(ROWS):
        for col in range(COLS):
            x = MARGIN + col*CARD_W
            y = MARGIN + (ROWS-1-r)*CARD_H
            yield x, y

def main():
    c = canvas.Canvas(OUT, pagesize=LETTER)

    # ── PAGE 1: FRONTS
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN, H-MARGIN+8, "Reagan's Shape Flashcards — FRONTS  ✂ Cut along the boxes")
    for shape, (x,y) in zip(SHAPES, positions()):
        draw_shape_front(c, shape, x, y)
    c.showPage()

    # ── PAGE 2: BACKS  (mirror columns so double-sided print lines up)
    # When printing duplex flip-on-long-edge, columns mirror left↔right.
    # So we walk SHAPES in pairs, swapping the two columns.
    c.setFillColor(colors.HexColor("#1f2937"))
    c.setFont("Helvetica-Bold", 11)
    c.drawString(MARGIN, H-MARGIN+8, "Reagan's Shape Flashcards — BACKS  (print double-sided)")
    backs = []
    for r in range(ROWS):
        idx = r*COLS
        backs.append(SHAPES[idx+1])
        backs.append(SHAPES[idx])
    for shape, (x,y) in zip(backs, positions()):
        draw_shape_back(c, shape, x, y)
    c.showPage()

    c.save()
    print("wrote", OUT)

if __name__ == "__main__":
    main()
