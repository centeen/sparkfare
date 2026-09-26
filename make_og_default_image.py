"""Generates og-default.png, the site-wide Open Graph / Twitter share image (1200x630).

Used by index.html's og:image / twitter:image. Built from the brand mark's exact geometry
(sparkfare_mark.svg: ticket stub outline + gold dot) and the style guide's Paper/Ledger palette,
set in Inter Medium (the committed src/assets/Inter-Medium.ttf) -- Space Grotesk, the guide's
headline face, isn't available as a local font file, so this is a raster approximation of the
guide's Headline treatment, not a pixel match. Re-run after any change to the tagline or mark:

    python make_og_default_image.py

Drawn at 4x and downsampled so the mark's strokes are antialiased (Pillow's line drawing isn't).
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
SS = 4  # supersample factor

PAPER = "#EDE6D6"
LEDGER = "#2B2620"
LEDGER_MUTED = "#6B6255"
SPARK = "#E8B930"  # the mark's own dot colour (style guide: dot in Spark, #E8B930)

FONT_PATH = "src/assets/Inter-Medium.ttf"
OUT_PATH = "og-default.png"

TAGLINE_LINES = ["It only sparks when", "the fare's real."]


def s(v):
    return int(round(v * SS))


def main():
    img = Image.new("RGB", (W * SS, H * SS), PAPER)
    d = ImageDraw.Draw(img)

    # Mark: geometry copied from sparkfare_mark.svg (viewBox 0 0 44 44).
    scale, ox, oy = 5.0, 110, 205
    pts = [(8, 8), (8, 36), (30, 36), (27, 29), (30, 22), (27, 15), (30, 8), (8, 8)]
    px = [(s(ox + x * scale), s(oy + y * scale)) for x, y in pts]
    d.line(px, fill=LEDGER, width=s(2.4 * scale), joint="curve")
    for x, y in px:  # round the joins and caps like stroke-linejoin/linecap="round"
        r = s(2.4 * scale) / 2
        d.ellipse([x - r, y - r, x + r, y + r], fill=LEDGER)
    cx, cy, cr = s(ox + 18 * scale), s(oy + 22 * scale), s(3.5 * scale)
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=SPARK)

    word = ImageFont.truetype(FONT_PATH, s(88))
    tag = ImageFont.truetype(FONT_PATH, s(46))
    small = ImageFont.truetype(FONT_PATH, s(28))

    tx = 440
    d.text((s(tx), s(150)), "Sparkfare", font=word, fill=LEDGER)
    for i, line in enumerate(TAGLINE_LINES):
        d.text((s(tx), s(285 + i * 64)), line, font=tag, fill=LEDGER)
    d.text((s(tx), s(470)), "Flight deals, priced honestly", font=small, fill=LEDGER_MUTED)
    d.text((s(tx), s(515)), "sparkfare.com", font=small, fill=LEDGER_MUTED)

    img = img.resize((W, H), Image.LANCZOS)
    img.save(OUT_PATH, optimize=True)
    print(f"wrote {OUT_PATH} ({W}x{H})")


if __name__ == "__main__":
    main()
