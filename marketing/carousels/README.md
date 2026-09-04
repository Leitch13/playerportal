# Instagram carousel templates

Slide decks for the carousel posts in `../content/30-day-instagram-calendar.md`, built as
HTML and imported into Canva as editable templates.

## Layout

- `build_slides.py` turns a spec into slides. Brand palette (cyan on navy) is the default style.
- `specs/*.json` one spec per carousel. Headline markup: `<em>` italic serif, `<b>` bold cyan,
  `<mark>` cyan highlight box. One emphasis per headline.
- `out/*.canva.html` generated. One `data-document-role="page"` per slide, 1080x1350.

## Rebuild and re-import

```
python3 build_slides.py specs/pricing-mistake.json --canva --out out
```

Commit and push, then import the raw GitHub URL of the `out/` file into Canva
(Design > Import, or the Canva connector's import-from-URL) as an Instagram post.
The repo is public, so anything in `out/` is readable by anyone; keep specs to content
you'd post anyway.

Backgrounds: add a `"bg"` field to a slide with a public image URL and the slide renders
the photo behind a gradient shade. `--prompts` prints image-generation prompts per slide.
