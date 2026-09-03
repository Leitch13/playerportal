/**
 * Generates the photo drop-zone images embedded in every template.
 *
 * They are real PNGs, not table boxes, so an academy can right-click ->
 * Change Picture in Word and their photo lands in the same frame at the same
 * crop. Run once; the output is committed alongside the builders.
 *
 *   node make-placeholders.js
 */
const { execFileSync } = require('child_process');
const path = require('path');
const OUT = path.join(__dirname, '..', 'assets', 'placeholders');

// label, width, height, tone ('light' on white pages | 'dark' on the navy cover)
const SLOTS = [
  ['cover-banner',   1600, 545, 'dark',  'A WIDE SHOT OF YOUR ACADEMY IN ACTION'],
  ['logo',            900, 330, 'dark',  'YOUR LOGO'],
  ['session',        1400, 620, 'light', 'A PHOTO OF A SESSION IN FULL FLOW'],
  ['venue',          1400, 620, 'light', 'YOUR VENUE — THE ENTRANCE THEY SHOULD USE'],
  ['welcome',        1400, 620, 'light', 'A NEW PLAYER BEING WELCOMED IN'],
  ['team',           1400, 620, 'light', 'YOUR PLAYERS, TOGETHER'],
  ['group',          1600, 545, 'light', 'YOUR WHOLE ACADEMY, TOGETHER'],
  ['coaching',       1400, 620, 'light', 'A COACH TALKING TO A SMALL GROUP'],
  ['headshot',        600, 600, 'light', 'COACH HEADSHOT'],
];

const py = `
import sys
from PIL import Image, ImageDraw, ImageFont

NAVY=(24,35,59); GOLD=(184,134,43); CREAM=(246,243,236)

def font(sz, bold=True):
    for p in ('/System/Library/Fonts/Supplemental/Arial Bold.ttf' if bold
              else '/System/Library/Fonts/Supplemental/Arial.ttf',
              '/System/Library/Fonts/Helvetica.ttc'):
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()

def track(d, xy, text, f, fill, sp):
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textlength(ch, font=f) + sp
    return x

def width_of(d, text, f, sp):
    return sum(d.textlength(c, font=f) + sp for c in text) - sp

def dashed(d, box, colour, w, dash, gap):
    x0,y0,x1,y1 = box
    for (ax,ay,bx,by) in ((x0,y0,x1,y0),(x0,y1,x1,y1)):
        x=ax
        while x < bx:
            d.line([x,ay,min(x+dash,bx),by], fill=colour, width=w); x += dash+gap
    for (ax,ay,bx,by) in ((x0,y0,x0,y1),(x1,y0,x1,y1)):
        y=ay
        while y < by:
            d.line([ax,y,bx,min(y+dash,by)], fill=colour, width=w); y += dash+gap

def build(name, W, H, tone, label):
    bg   = (31, 44, 71) if tone=='dark' else CREAM
    line = GOLD
    ink  = (168,178,196) if tone=='dark' else (120,128,142)
    img = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(img)
    m = max(6, int(min(W,H)*0.035))
    dashed(d, (m, m, W-m, H-m), line, max(2,int(W/420)), int(W/38), int(W/60))

    # camera glyph
    s = int(min(W, H) * 0.16)
    cx, cy = W//2, int(H*0.42)
    lw = max(2, int(s*0.09))
    body = (cx-s, cy-int(s*0.62), cx+s, cy+int(s*0.62))
    d.rounded_rectangle(body, radius=int(s*0.18), outline=line, width=lw)
    d.rounded_rectangle((cx-int(s*0.34), cy-int(s*0.86), cx+int(s*0.06), cy-int(s*0.55)),
                        radius=int(s*0.1), outline=line, width=lw)
    d.ellipse((cx-int(s*0.34), cy-int(s*0.34), cx+int(s*0.34), cy+int(s*0.34)),
              outline=line, width=lw)

    fsz = max(11, int(W/(26 if H/W > 0.3 and W < 1000 else 46)))
    f = font(fsz)
    sp = fsz*0.16
    tw = width_of(d, label, f, sp)
    ty = int(H*0.70)
    track(d, ((W-tw)/2, ty), label, f, ink, sp)

    f2 = font(int(fsz*0.82), bold=False)
    sub = 'right-click  >  change picture'
    sw = width_of(d, sub, f2, sp*0.6)
    track(d, ((W-sw)/2, ty + fsz*2.0), sub, f2, ink, sp*0.6)

    img.save(name)
    print('  ', name.split('/')[-1], W, 'x', H)

build(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5])
`;

const fs = require('fs');
fs.mkdirSync(OUT, { recursive: true });
const tmp = path.join(OUT, '_gen.py');
fs.writeFileSync(tmp, py);
for (const [name, w, h, tone, label] of SLOTS) {
  execFileSync('python3', [tmp, path.join(OUT, `${name}.png`), String(w), String(h), tone, label],
               { stdio: 'inherit' });
}
fs.unlinkSync(tmp);
console.log('placeholders ->', OUT);
