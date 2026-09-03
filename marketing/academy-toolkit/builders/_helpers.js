/**
 * Academy in a Box — shared docx builder helpers.
 *
 * Every document in the toolkit (Academy Bible, Parent Pack, Player Pack,
 * Foundation/Traction guides) is built from these so they look like one family.
 *
 * TO RE-THEME THE WHOLE TOOLKIT: change `theme` below. Nothing else.
 *
 * Placeholder convention — two tiers, deliberately different:
 *   [LIKE THIS]   short inline fill-in  -> bold navy on yellow highlight ("chip")
 *   guidance(...)  editorial instruction -> italic grey, gold left rule
 * so an academy can see at a glance what to *replace* vs what to *write*.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, HeadingLevel, VerticalAlign,
  PageOrientation, ShadingType, convertInchesToTwip, ImageRun,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- theme
const theme = {
  ink:    '18233B', // navy — headings, cover, table headers
  accent: 'B8862B', // gold — section numbers, rules, accents
  paper:  'FFFFFF',
  cream:  'F6F3EC', // table zebra stripe
  grey:   '6B7280', // guidance text
  chip:   '1F4FD8', // placeholder text colour
  font:   'Calibri',
};

const A4 = { width: 11906, height: 16838 };
const MARGIN = convertInchesToTwip(0.85);
const CONTENT_W = A4.width - MARGIN * 2;

// ---------------------------------------------------------------- runs
const NONE = { style: BorderStyle.NONE, size: 0, color: 'auto' };
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE,
                    insideHorizontal: NONE, insideVertical: NONE };

/**
 * Split a string on [PLACEHOLDERS] and style each one.
 *
 * `mark` decides how loud the placeholder is, because the same yellow that
 * makes a fill-in obvious mid-sentence turns a table into a highlighter pen:
 *   'chip'  bold navy-blue on yellow  — inside real prose an academy will keep
 *   'quiet' bold blue, no highlight   — tables and owner-only guidance, where
 *                                       the surrounding block is already a form
 *   'gold'  bold gold, no highlight   — on the navy cover
 *   'none'  no styling                — footers, running text
 */
function pr(text, base = {}, mark = 'chip') {
  const style = {
    chip:  { bold: true, color: theme.chip, highlight: 'yellow' },
    quiet: { bold: true, color: theme.chip },
    gold:  { bold: true, color: theme.accent },
    none:  {},
  }[mark] || {};
  const out = [];
  for (const part of String(text).split(/(\[[^\]]*\])/g)) {
    if (!part) continue;
    const isPh = part.startsWith('[') && part.endsWith(']');
    out.push(new TextRun({ ...base, ...(isPh ? style : {}), text: part }));
  }
  return out;
}

const font = (size, extra = {}) => ({ font: theme.font, size, ...extra });

// ---------------------------------------------------------------- blocks
const body = (t, o = {}) => new Paragraph({
  children: pr(t, font(22, { color: '222222' })),
  spacing: { after: 140, line: 290 }, ...o,
});

const lead = (t) => new Paragraph({
  children: pr(t, font(26, { color: theme.ink })),
  spacing: { after: 220, line: 300 },
});

const h2 = (t) => new Paragraph({
  children: pr(t, font(28, { bold: true, color: theme.ink })),
  spacing: { before: 320, after: 140 }, keepNext: true,
});

const h3 = (t) => new Paragraph({
  children: pr(t, font(23, { bold: true, color: theme.ink })),
  spacing: { before: 240, after: 100 }, keepNext: true,
});

/** Same as h2 but opens a new page — for splitting a long section deliberately
 *  rather than letting it dribble three lines onto an empty one. */
const h2Page = (t) => new Paragraph({
  children: pr(t, font(28, { bold: true, color: theme.ink })),
  spacing: { before: 0, after: 140 }, keepNext: true, pageBreakBefore: true,
});

const bullet = (t) => new Paragraph({
  children: [new TextRun(font(22, { text: '—  ', color: theme.accent, bold: true })),
             ...pr(t, font(22, { color: '222222' }))],
  spacing: { after: 100, line: 285 }, indent: { left: 240, hanging: 240 },
});

const check = (t) => new Paragraph({
  children: [new TextRun(font(22, { text: '☐  ', color: theme.ink })),
             ...pr(t, font(22, { color: '222222' }))],
  spacing: { after: 130, line: 285 }, indent: { left: 300, hanging: 300 },
});

const num = (n, t) => new Paragraph({
  children: [new TextRun(font(22, { text: `${n}.  `, color: theme.accent, bold: true })),
             ...pr(t, font(22, { color: '222222' }))],
  spacing: { after: 110, line: 285 }, indent: { left: 300, hanging: 300 },
});

/** Editorial instruction to the academy owner — never sent to a parent as-is. */
const guidance = (t) => new Paragraph({
  children: pr(t, font(21, { italics: true, color: theme.grey }), 'quiet'),
  spacing: { before: 140, after: 180, line: 285 },
  indent: { left: 260 },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: theme.accent, space: 12 } },
});

/**
 * Ruled blank for hand-filling on a printed copy: a small label, then an
 * empty line with real height above the rule so there is room to write.
 */
const fieldLine = (label) => ([
  new Paragraph({
    children: pr(label.toUpperCase(), font(17, { color: theme.grey, bold: true,
                                                 characterSpacing: 40 }), 'none'),
    spacing: { before: 340, after: 0 },
  }),
  new Paragraph({
    children: [new TextRun(font(28, { text: ' ' }))],
    spacing: { before: 0, after: 40, line: 400 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'BBBBBB', space: 4 } },
  }),
]);

/** Gold section number + hairline rule + title. */
const sectionDivider = (n, title) => ([
  new Paragraph({
    children: [new TextRun(font(48, { text: n, bold: true, color: theme.accent }))],
    spacing: { before: 420, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: theme.ink, space: 6 } },
  }),
  new Paragraph({
    children: pr(title, font(40, { bold: true, color: theme.ink })),
    spacing: { before: 160, after: 240 },
  }),
]);

const callout = (t) => new Table({
  width: { size: CONTENT_W, type: WidthType.DXA },
  borders: {
    ...noBorders,
    left: { style: BorderStyle.SINGLE, size: 18, color: theme.accent },
  },
  rows: [new TableRow({ children: [new TableCell({
    shading: { type: ShadingType.CLEAR, fill: theme.cream },
    margins: { top: 200, bottom: 200, left: 260, right: 260 },
    children: [new Paragraph({ children: pr(t, font(22, { color: theme.ink })),
                               spacing: { line: 290 } })],
  })] })],
});

/**
 * headers: string[]; rows: string[][]; widths: fractions summing to ~1
 */
function dataTable(headers, rows, widths) {
  const w = widths || headers.map(() => 1 / headers.length);
  const cw = w.map((f) => Math.round(CONTENT_W * f));
  const cell = (text, opts) => new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: opts.fill },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({
      children: pr(text, font(20, { color: opts.head ? 'FFFFFF' : '222222',
                                    bold: !!opts.head }), opts.head ? 'none' : 'quiet'),
      spacing: { line: 275 },
    })],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: {
      top: NONE, bottom: NONE, left: NONE, right: NONE,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
      insideVertical: NONE,
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map((h, i) =>
          cell(h, { width: cw[i], fill: theme.ink, head: true })),
      }),
      ...rows.map((r, ri) => new TableRow({
        cantSplit: true,
        children: r.map((c, i) =>
          cell(c, { width: cw[i], fill: ri % 2 ? theme.cream : 'FFFFFF' })),
      })),
    ],
  });
}

// ------------------------------------------------------------- photos
const PLACEHOLDERS = path.join(__dirname, '..', 'assets', 'placeholders');
const PX_FULL = 410;   // inset from the 645px column — a centred photo reads
                       // as deliberate, and full-width ones pushed sections
                       // onto near-empty overflow pages
const PX_COVER = 620;  // inside the cover cell's margins

/** Read intrinsic size straight from the PNG IHDR so callers only give width. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function imageRun(slot, width) {
  const file = path.join(PLACEHOLDERS, `${slot}.png`);
  const { w, h } = pngSize(file);
  return new ImageRun({
    type: 'png',
    data: fs.readFileSync(file),
    transformation: { width, height: Math.round(width * h / w) },
  });
}

/**
 * A photo drop-zone: a real embedded PNG, so in Word the academy can
 * right-click -> Change Picture and their own shot lands in the same frame.
 * `caption` renders underneath in small gold caps.
 */
function photo(slot, { width = PX_FULL, caption, before = 240, after = 160 } = {}) {
  const out = [new Paragraph({
    children: [imageRun(slot, width)],
    alignment: AlignmentType.CENTER,
    spacing: { before, after: caption ? 80 : after },
  })];
  if (caption) {
    out.push(new Paragraph({
      children: pr(caption, font(16, { color: theme.accent, bold: true,
                                       characterSpacing: 40 }), 'none'),
      alignment: AlignmentType.CENTER,
      spacing: { after },
    }));
  }
  return out;
}

/** Several photo slots side by side — e.g. a row of coach headshots. */
function photoRow(slots, captions = []) {
  const each = Math.floor(CONTENT_W / slots.length);
  const px = Math.floor((each / 1440) * 96) - 12;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: noBorders,
    rows: [new TableRow({
      children: slots.map((slot, i) => new TableCell({
        width: { size: each, type: WidthType.DXA },
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: [
          new Paragraph({ children: [imageRun(slot, px)],
                          alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
          new Paragraph({
            children: pr(captions[i] || '', font(16, { color: theme.accent, bold: true,
                                                      characterSpacing: 30 }), 'none'),
            alignment: AlignmentType.CENTER,
          }),
        ],
      })),
    })],
  });
}

/** Brand colour swatches with a blank cell for the academy's own hex. */
function swatchTable(rows) {
  const w = [0.16, 0.30, 0.26, 0.28].map((f) => Math.round(CONTENT_W * f));
  const txt = (t, o = {}) => new Paragraph({
    children: pr(t, font(20, { color: o.color || '222222', bold: !!o.bold }), o.mark || 'quiet'),
    spacing: { line: 275 },
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    borders: { top: NONE, bottom: NONE, left: NONE, right: NONE,
               insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
               insideVertical: NONE },
    rows: rows.map((r) => new TableRow({
      children: [
        new TableCell({ width: { size: w[0], type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: r.hex },
          borders: { top: { style: BorderStyle.SINGLE, size: 2, color: 'C9CEd6' },
                     bottom: { style: BorderStyle.SINGLE, size: 2, color: 'C9CED6' },
                     left: { style: BorderStyle.SINGLE, size: 2, color: 'C9CED6' },
                     right: { style: BorderStyle.SINGLE, size: 2, color: 'C9CED6' } },
          margins: { top: 200, bottom: 200, left: 100, right: 100 }, children: [new Paragraph('')] }),
        new TableCell({ width: { size: w[1], type: WidthType.DXA },
          margins: { top: 140, bottom: 140, left: 160, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [txt(r.role, { bold: true, color: theme.ink, mark: 'none' })] }),
        new TableCell({ width: { size: w[2], type: WidthType.DXA },
          margins: { top: 140, bottom: 140, left: 160, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [txt(`Currently #${r.hex}`, { mark: 'none' })] }),
        new TableCell({ width: { size: w[3], type: WidthType.DXA },
          margins: { top: 140, bottom: 140, left: 160, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [txt(r.replace)] }),
      ],
    })),
  });
}

/**
 * Full-bleed coloured cover.
 * docx has no per-section page background, so the cover is its own
 * zero-margin section holding one navy-shaded borderless table cell.
 */
function coverSection(lines) {
  const inner = [];
  for (const l of lines) {
    if (l.gap) { inner.push(new Paragraph({ text: '', spacing: { after: l.gap } })); continue; }
    if (l.image) {
      inner.push(new Paragraph({
        children: [imageRun(l.image, l.width || PX_COVER)],
        alignment: l.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { after: l.after == null ? 160 : l.after },
      }));
      continue;
    }
    inner.push(new Paragraph({
      alignment: l.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: pr(l.text, font(l.size || 24, {
        bold: !!l.bold, color: l.color || 'FFFFFF',
        italics: !!l.italics, characterSpacing: l.tracking || 0,
      }), l.mark || 'gold'),
      spacing: { after: l.after == null ? 120 : l.after, line: l.line || 300 },
    }));
  }
  return {
    properties: {
      page: { size: { width: A4.width, height: A4.height },
              margin: { top: 0, bottom: 0, left: 0, right: 0 } },
    },
    children: [new Table({
      width: { size: A4.width, type: WidthType.DXA },
      borders: noBorders,
      rows: [new TableRow({
        height: { value: A4.height - 20, rule: 'exact' },
        children: [new TableCell({
          shading: { type: ShadingType.CLEAR, fill: theme.ink },
          margins: { top: 1400, bottom: 900, left: 1100, right: 1100 },
          verticalAlign: VerticalAlign.CENTER,
          children: inner,
        })],
      })],
    })],
  };
}

const pageBreak = () => new Paragraph({ text: '', pageBreakBefore: true });

function build(outPath, { cover, children, footer }) {
  const doc = new Document({
    styles: { default: { document: { run: { font: theme.font, size: 22 } } } },
    sections: [
      cover,
      {
        properties: {
          page: { size: { width: A4.width, height: A4.height },
                  margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        footers: footer ? { default: footer } : undefined,
        children,
      },
    ],
  });
  return Packer.toBuffer(doc).then((buf) => {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buf);
    console.log('wrote', outPath, (buf.length / 1024).toFixed(1) + 'kb');
  });
}

module.exports = {
  theme, A4, MARGIN, CONTENT_W, PX_FULL, PX_COVER, pr, font,
  photo, photoRow, swatchTable, imageRun,
  body, lead, h2, h2Page, h3, bullet, check, num, guidance, fieldLine,
  sectionDivider, callout, dataTable, coverSection, pageBreak, build,
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, VerticalAlign, Footer: require('docx').Footer,
};
