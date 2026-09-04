#!/usr/bin/env python3
"""Build Instagram carousel slides from a spec JSON.

usage:
  build_slides.py spec.json --canva [--out <dir>]   # one HTML file, one page per slide, for Canva import
  build_slides.py spec.json --out <dir>             # Claude Design artboards (<Name>.dc.html + canvas.json)
  build_slides.py spec.json --prompts               # prints image-generation prompts (JSON)

Spec shape:
  {
    "name": "pricing-mistake",          # file slug
    "title": "The pricing mistake",     # design name in Canva
    "handle": "@playitloveit",
    "style": { ...overrides of DEFAULT_STYLE... },
    "slides": [
      { "name": "Main", "title": "Hook", "mode": "dark",
        "headline": "The pricing mistake <em>killing</em> your coaching business",
        "sub": "...", "pills": ["..."], "stack": ["..."], "cta": "...", "foot": "Swipe",
        "image": "a football on a wet pitch", "bg": "https://.../photo.jpg" }
    ]
  }

Headline markup: <em>word</em> = italic serif, <b>word</b> = bold accent,
<mark>word</mark> = accent highlight box, <br> = line break. One emphasis per headline.

Canva import: the --canva file is one HTML document with a `data-document-role="page"`
element per slide. Push it to a public URL (this repo is public, so the raw GitHub URL works)
and import it with Canva's "import design from URL" as an Instagram post.
"""
import json, os, re, sys

DEFAULT_STYLE = {
    # PlayIt Love It brand: cyan accent on deep navy (see src/app/globals.css --pp-* tokens)
    "accent": "#4ECDE6", "accent_deep": "#2BA8C3",
    "dark_bg": "#080E18", "dark_fg": "#FFFFFF", "dark_muted": "#93A2BA", "dark_card": "#0F1A2B",
    "light_bg": "#F8FAFC", "light_fg": "#0F172A", "light_muted": "#64748B",
    "sans": "'Inter', 'Helvetica Neue', Arial, sans-serif",
    "serif": "'Instrument Serif', Georgia, 'Times New Roman', serif",
    "font_import": "https://fonts.googleapis.com/css2?family=Inter:wght@300;500;600;800&family=Instrument+Serif:ital@1&display=swap",
    "headline_px": 84, "serif_px": 100, "sub_px": 34, "pill_px": 26, "foot_px": 24, "stack_px": 48,
}

W, H = 1080, 1350

BASE_PROMPT_DARK = ("Premium dark 3D product render for a social media ad, portrait. Near-black navy background with a faint "
    "thin gray square grid pattern. In the lower center: {object}. Lit from below and behind by a vivid cyan glow "
    "that bleeds up from the bottom edge, a thin glowing cyan horizon light line on the dark glossy floor, and a subtle "
    "cyan rim light on the object's right edge. The top 45 percent of the frame is empty dark space with only the faint "
    "grid, for text. Glossy, photoreal, cinematic, high contrast. No text, no letters, no logos{people}.")
BASE_PROMPT_LIGHT = ("Premium bright 3D product render for a social media ad, portrait, light mode. Cool off-white "
    "background with a faint thin gray square grid pattern. In the lower center: {object}. A soft vivid cyan glow rises "
    "from the bottom edge of the frame and bleeds upward behind the object, with a thin glowing cyan horizon light line "
    "on the floor and a subtle cyan rim light on the object's right edge. The top 45 percent of the frame is clean empty "
    "space with only the faint grid, for text. Glossy, photoreal, soft studio lighting, high quality. No text, no "
    "letters, no logos{people}.")
BASE_PROMPT_EMPTY = ("Premium dark 3D render background for a social media ad, portrait. Near-black navy background with a faint "
    "thin gray square grid pattern. The lower third has a dark glossy floor with a thin glowing cyan horizon light "
    "line and a vivid cyan glow bleeding up from the bottom edge, with {object}. No objects in the center. The top 70 "
    "percent of the frame is empty dark space with only the faint grid, for text. Glossy, photoreal, cinematic. No text, "
    "no letters, no logos{people}.")


def rgb(h):
    h = h.lstrip("#"); return ",".join(str(int(h[i:i+2], 16)) for i in (0, 2, 4))

def esc(s):
    """Escape bare ampersands and stray angle brackets, keeping our tiny markup vocabulary."""
    s = re.sub(r"&(?![a-zA-Z#][a-zA-Z0-9]*;)", "&amp;", s)
    return re.sub(r"<(?!/?(em|b|mark|br)\b)", "&lt;", s)

def mark_svg(color):
    pts = [(28,8),(16,12),(40,12),(9,22),(47,22),(7,34),(49,34),(14,45),(42,45),(28,50),(28,20),(18,28),(38,28),(28,36)]
    c = "".join(f'<circle cx="{x}" cy="{y}" r="3" fill="{color}"></circle>' for x, y in pts)
    c += f'<circle cx="28" cy="28" r="4" fill="{color}"></circle>'
    return f'<svg viewBox="0 0 56 56" width="56" height="56" xmlns="http://www.w3.org/2000/svg" style="display: block;">{c}</svg>'

def arrow_svg(color):
    return (f'<svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" style="display: block;">'
            f'<path d="M7 17 L17 7 M9 7 H17 V15" fill="none" stroke="{color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>')

def play_svg(color):
    return (f'<svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg" style="display: block;">'
            f'<path d="M5 4 L20 12 L5 20 Z" fill="{color}"></path></svg>')

def pill(text, st, mode, fill=False):
    fg = st["dark_bg"] if fill else (st["dark_fg"] if mode == "dark" else st["light_fg"])
    bg = st["accent"] if fill else "transparent"
    return (f'<div style="display: inline-flex; align-items: center; border: 2px solid {st["accent"]}; background: {bg}; '
            f'color: {fg}; border-radius: 999px; padding: 12px 32px; font-weight: 600; font-size: {st["pill_px"]}px; '
            f'line-height: 1.2; white-space: nowrap;">{esc(text)}</div>')

def headline_html(h, st, mode):
    """Turn the short markup into inline-styled spans the editor can restyle."""
    h = esc(h)
    h = h.replace("<em>", f'<em style="font-family: {st["serif"]}; font-style: italic; font-weight: 400; font-size: {st["serif_px"]}px;">')
    h = h.replace("<b>", f'<b style="font-weight: 800; color: {st["accent"]};">')
    h = h.replace("<mark>", f'<span style="background: {st["accent"]}; color: {st["dark_bg"]}; display: inline-block; padding: 4px 18px 8px; border-radius: 12px; font-weight: 700; line-height: 1;">')
    h = h.replace("</mark>", "</span>")
    return h

def stack_html(items, st, mode):
    dark = mode == "dark"
    card = st["dark_card"] if dark else "#FFFFFF"
    fg = st["dark_fg"] if dark else st["light_fg"]
    box = lambda t: (f'<div style="width: 640px; padding: 22px 24px; text-align: center; font-size: {st["stack_px"]}px; font-weight: 600; color: {fg}; '
                     f'background: {card}; border: 2px solid {st["accent"]}; border-radius: 16px; box-shadow: 0 0 40px 4px rgba({rgb(st["accent"])},0.35);">{esc(t)}</div>')
    return f'<div style="display: flex; flex-direction: column; align-items: center; gap: 22px; padding-bottom: 36px;">{"".join(box(t) for t in items)}</div>'

def slide_body(sl, spec, st, bg_src):
    """The 1080x1350 slide as inline-styled HTML (no document wrapper)."""
    mode = sl.get("mode", "dark"); dark = mode == "dark"
    bg = st["dark_bg"] if dark else st["light_bg"]
    fg = st["dark_fg"] if dark else st["light_fg"]
    muted = st["dark_muted"] if dark else st["light_muted"]
    line = "rgba(255,255,255,0.06)" if dark else "rgba(0,0,0,0.07)"
    acc = st["accent"]; ar = rgb(acc)
    has_mark = "<mark>" in sl["headline"]
    lh = "1.3" if has_mark else "1.05"
    sub = sl.get("sub")
    sub_html = f'<p style="margin: 0; font-size: {st["sub_px"]}px; line-height: 1.4; color: {muted}; max-width: 780px;">{esc(sub)}</p>' if sub else ""
    pills = sl.get("pills") or []
    pills_row = f'<div style="display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;">{"".join(pill(p, st, mode) for p in pills)}</div>' if pills else ""
    cta = sl.get("cta")
    cta_html = f'<div style="display: flex; justify-content: center; padding-top: 30px;">{pill(cta, st, mode, True)}</div>' if cta else ""
    hero = stack_html(sl["stack"], st, mode) if sl.get("stack") else ""
    if bg_src:
        sb = rgb(bg)
        shade = f"rgba({sb},0.93), rgba({sb},0.58) 60%, rgba({sb},0)"
        backdrop = (f'<img src="{bg_src}" style="position: absolute; top: 0; left: 0; width: {W}px; height: {H}px; object-fit: cover; object-position: center bottom; display: block;">'
                    f'<div style="position: absolute; top: 0; left: 0; width: {W}px; height: 620px; background: linear-gradient(180deg, {shade});"></div>')
        horizon = ""
    else:
        backdrop = (f'<div style="position: absolute; top: 0; left: 0; width: {W}px; height: {H}px; background-image: linear-gradient({line} 1px, transparent 1px), linear-gradient(90deg, {line} 1px, transparent 1px); background-size: 72px 72px;"></div>'
                    f'<div style="position: absolute; left: -300px; bottom: -560px; width: 1680px; height: 1160px; background: radial-gradient(ellipse at center, rgba({ar},0.55) 0%, rgba({ar},0.18) 32%, rgba({ar},0) 62%);"></div>')
        horizon = f'<div style="height: 3px; margin: 0 40px; background: linear-gradient(90deg, rgba({ar},0), {acc}, rgba({ar},0)); box-shadow: 0 0 44px 8px rgba({ar},0.5);"></div>'
    handle = spec.get("handle", "@playitloveit")
    return f'''<div style="position: relative; width: {W}px; height: {H}px; overflow: hidden; box-sizing: border-box; background: {bg}; color: {fg}; font-family: {st["sans"]}; font-weight: 300;">
  {backdrop}
  <div style="position: relative; width: {W}px; height: {H}px; box-sizing: border-box; padding: 60px 72px 52px; display: flex; flex-direction: column;">
    <div style="display: flex; align-items: center; height: 56px;">{mark_svg(acc)}</div>
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 22px; padding-top: 36px;">
      <h1 style="margin: 0; font-size: {st["headline_px"]}px; line-height: {lh}; font-weight: 300; letter-spacing: -0.01em;">{headline_html(sl["headline"], st, mode)}</h1>
      {sub_html}
      {pills_row}
    </div>
    <div style="flex: 1 1 auto; min-height: 0; position: relative; display: flex; align-items: flex-end; justify-content: center; padding: 24px 0 0;">
      {hero}
    </div>
    {horizon}
    {cta_html}
    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 28px; font-size: {st["foot_px"]}px; font-weight: 500;">
      <div style="display: flex; align-items: center; gap: 10px;">{arrow_svg(fg)}<span>{esc(sl.get("foot", ""))}</span></div>
      <div style="display: flex; align-items: center; gap: 10px;">{play_svg(fg)}<span>{esc(handle)}</span></div>
    </div>
  </div>
</div>'''

def dc_document(sl, spec, st, bg_src):
    """Claude Design artboard wrapper."""
    return f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
    @import url('{st["font_import"]}');
    body {{ margin: 0; }}
  </style>
</helmet>
{slide_body(sl, spec, st, bg_src)}
</x-dc>
</body>
</html>
'''

def canva_document(spec, st, slides, bg_for):
    """One HTML document, one data-document-role="page" element per slide, for Canva's URL import."""
    pages = []
    for i, sl in enumerate(slides, 1):
        label = f"{i:02d} {sl.get('title', sl['name'])}"
        pages.append(f'<section data-document-role="page" data-label="{esc(label)}" style="width: {W}px; height: {H}px; margin: 0 0 40px 0; overflow: hidden;">\n{slide_body(sl, spec, st, bg_for(sl))}\n</section>')
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{esc(spec.get("title", spec.get("name", "Carousel")))}</title>
  <link rel="stylesheet" href="{st["font_import"]}">
  <style>
    body {{ margin: 0; padding: 40px; background: #1a1a1a; }}
    h1, p {{ margin: 0; }}
  </style>
</head>
<body>
{chr(10).join(pages)}
</body>
</html>
'''

def prompts(slides):
    out = []
    for i, sl in enumerate(slides, 1):
        img = sl.get("image")
        if not img: continue
        mode = sl.get("mode", "dark")
        people = "" if sl.get("people") else ", no people"
        if sl.get("image_kind") == "empty":
            p = BASE_PROMPT_EMPTY.format(object=img, people=people)
        elif mode == "light":
            p = BASE_PROMPT_LIGHT.format(object=img, people=people)
        else:
            p = BASE_PROMPT_DARK.format(object=img, people=people)
        out.append({"index": i, "name": sl["name"], "params": {"model": "gpt_image_2", "aspect_ratio": "3:4",
                    "resolution": "2k", "quality": "high", "prompt": p}})
    return out

def main():
    args = sys.argv[1:]
    if not args or args[0].startswith("--"):
        print(__doc__); sys.exit(1)
    spec = json.load(open(args[0]))
    st = dict(DEFAULT_STYLE); st.update(spec.get("style", {}))
    slides = spec["slides"]
    if slides[0]["name"] != "Main":
        slides[0]["name"] = "Main"  # the entry artboard must be Main
    if "--prompts" in args:
        print(json.dumps(prompts(slides), indent=2)); return
    out_dir = "."
    if "--out" in args:
        i = args.index("--out")
        if i + 1 >= len(args): print("--out needs a directory"); sys.exit(2)
        out_dir = args[i + 1]
    os.makedirs(out_dir, exist_ok=True)
    if "--canva" in args:
        # Backgrounds must be absolute URLs Canva can fetch; a slide's "bg" field carries one.
        html = canva_document(spec, st, slides, lambda sl: sl.get("bg"))
        p = os.path.join(out_dir, f"{spec.get('name', 'carousel')}.canva.html")
        open(p, "w").write(html)
        print(p, "written;", len(slides), "pages"); return
    boards = []
    for i, sl in enumerate(slides):
        local = f"bg-{sl['name']}.jpg"
        bg_src = sl.get("bg") or (local if os.path.exists(os.path.join(out_dir, local)) else None)
        p = os.path.join(out_dir, sl["name"] + ".dc.html")
        open(p, "w").write(dc_document(sl, spec, st, bg_src))
        boards.append({"file": sl["name"] + ".dc.html", "title": f"{i+1:02d} {sl.get('title', sl['name'])}",
                       "x": i * (W + 100), "y": 0, "w": W, "h": H})
        print(sl["name"], "photo" if bg_src else "no photo yet")
    json.dump({"artboards": boards, "launch": {"view": "canvas"}}, open(os.path.join(out_dir, "canvas.json"), "w"), indent=2)
    print("canvas.json written;", len(boards), "slides")

if __name__ == "__main__":
    main()
